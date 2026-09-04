import os
from flask import Flask, redirect, url_for, render_template, request, session, flash, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.secret_key = "supersecreto-cambia-esto-en-produccion"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///pareja.sqlite3"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# ── Modelos ────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    pin      = db.Column(db.String(4),  nullable=False)
    status   = db.Column(db.String(100), default="")

    def __init__(self, username, pin):
        self.username = username
        self.pin      = pin

# ── Seed de usuarios predeterminados ──────────────────────────────────────────

def seed_users():
    defaults = [("Sofía", "1234"), ("Daniel", "5678")]
    for username, pin in defaults:
        if not User.query.filter_by(username=username).first():
            db.session.add(User(username=username, pin=pin))
    db.session.commit()

# ── Rutas ─────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    session.clear()
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        pin      = request.form.get("pin", "").strip()

        user = User.query.filter_by(username=username).first()
        if user and user.pin == pin:
            session["user_id"]  = user.id
            session["username"] = user.username
            return redirect(url_for("dashboard"))
        else:
            flash("Usuario o PIN incorrecto.")
            return render_template("login.html")

    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        flash("Inicia sesión primero.")
        return redirect(url_for("login"))

    me = User.query.get(session["user_id"])
    
    # Asignación explícita según quién haya iniciado sesión
    partner_name = "Daniel" if me.username.capitalize() == "Sofía" else "Sofía"
    partner = User.query.filter_by(username=partner_name).first()

    return render_template("user.html", me=me, partner=partner)


@app.route("/update_status", methods=["POST"])
def update_status():
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "No autenticado"}), 401

    data = request.get_json(silent=True) or {}
    status = data.get("status", "").strip()

    allowed = [
        "Pienso en ti",
        "Necesito llamarte",
        "Tengo que contarte algo",
        "Estoy sobrepensando",
        "Me apetece tener una cita",
    ]
    if status not in allowed:
        return jsonify({"ok": False, "error": "Estado no válido"}), 400

    # Garantiza que se actualiza ÚNICAMENTE el usuario logueado en esta sesión
    user = User.query.get(session["user_id"])
    user.status = status
    db.session.commit()
    
    return jsonify({"ok": True, "status": status})


@app.route("/partner_status")
def partner_status():
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "No autenticado"}), 401

    me = User.query.get(session["user_id"])
    partner_name = "Daniel" if me.username.capitalize() == "Sofía" else "Sofía"
    partner = User.query.filter_by(username=partner_name).first()

    if partner:
        return jsonify({
            "ok": True,
            "status": partner.status,
            "username": partner.username
        })

    return jsonify({"ok": False, "error": "Pareja no encontrada"}), 404


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Entrypoint ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_users()
    
    # Lee el puerto que asigna Render (o usa 5000 en local)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
