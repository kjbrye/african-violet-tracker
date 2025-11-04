import os
from datetime import date
from typing import List, Optional

from flask import Flask, redirect, render_template, request, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "violets.db")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "violets-secret")

db = SQLAlchemy(app)


class Cultivar(db.Model):
    __tablename__ = "cultivars"

    id: int = db.Column(db.Integer, primary_key=True)
    name: str = db.Column(db.String(120), nullable=False, unique=True)
    flower_color: Optional[str] = db.Column(db.String(80))
    leaf_description: Optional[str] = db.Column(db.String(120))
    acquisition_date: Optional[date] = db.Column(db.Date)
    light_level: Optional[str] = db.Column(db.String(80))
    soil_mix: Optional[str] = db.Column(db.String(120))
    notes: Optional[str] = db.Column(db.Text)

    care_logs: List["CareLog"] = db.relationship(
        "CareLog", back_populates="cultivar", cascade="all, delete-orphan"
    )

    def latest_care(self) -> Optional["CareLog"]:
        return max(self.care_logs, key=lambda log: log.performed_on, default=None)


class CareLog(db.Model):
    __tablename__ = "care_logs"

    id: int = db.Column(db.Integer, primary_key=True)
    cultivar_id: int = db.Column(db.Integer, db.ForeignKey("cultivars.id"), nullable=False)
    performed_on: date = db.Column(db.Date, nullable=False, default=date.today)
    action: str = db.Column(db.String(80), nullable=False)
    notes: Optional[str] = db.Column(db.Text)

    cultivar: Cultivar = db.relationship("Cultivar", back_populates="care_logs")


@app.before_first_request
def initialize_database() -> None:
    db.create_all()


@app.route("/")
def index():
    cultivars = (
        db.session.query(Cultivar, func.max(CareLog.performed_on).label("latest"))
        .outerjoin(CareLog)
        .group_by(Cultivar.id)
        .order_by(Cultivar.name)
        .all()
    )
    return render_template("index.html", cultivars=cultivars)


@app.route("/cultivars/new", methods=["GET", "POST"])
def add_cultivar():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if not name:
            flash("Cultivar name is required.", "error")
            return render_template("cultivar_form.html")

        acquisition_date_raw = request.form.get("acquisition_date")
        acquisition_date = (
            date.fromisoformat(acquisition_date_raw)
            if acquisition_date_raw
            else None
        )

        cultivar = Cultivar(
            name=name,
            flower_color=request.form.get("flower_color") or None,
            leaf_description=request.form.get("leaf_description") or None,
            acquisition_date=acquisition_date,
            light_level=request.form.get("light_level") or None,
            soil_mix=request.form.get("soil_mix") or None,
            notes=request.form.get("notes") or None,
        )
        db.session.add(cultivar)
        try:
            db.session.commit()
            flash(f"Added cultivar '{cultivar.name}'.", "success")
            return redirect(url_for("index"))
        except Exception:
            db.session.rollback()
            flash(
                "Could not save cultivar. Ensure the name is unique and try again.",
                "error",
            )
    return render_template("cultivar_form.html")


@app.route("/cultivars/<int:cultivar_id>")
def show_cultivar(cultivar_id: int):
    cultivar = Cultivar.query.get_or_404(cultivar_id)
    care_logs = (
        CareLog.query.filter_by(cultivar_id=cultivar.id)
        .order_by(CareLog.performed_on.desc())
        .all()
    )
    return render_template(
        "cultivar_detail.html",
        cultivar=cultivar,
        care_logs=care_logs,
        today=date.today(),
    )


@app.route("/cultivars/<int:cultivar_id>/care", methods=["POST"])
def add_care_log(cultivar_id: int):
    cultivar = Cultivar.query.get_or_404(cultivar_id)

    performed_on_raw = request.form.get("performed_on")
    performed_on = (
        date.fromisoformat(performed_on_raw)
        if performed_on_raw
        else date.today()
    )

    care_log = CareLog(
        cultivar=cultivar,
        action=request.form.get("action", "Care"),
        notes=request.form.get("notes") or None,
        performed_on=performed_on,
    )
    db.session.add(care_log)
    db.session.commit()
    flash("Care log added.", "success")
    return redirect(url_for("show_cultivar", cultivar_id=cultivar.id))


@app.route("/cultivars/<int:cultivar_id>/delete", methods=["POST"])
def delete_cultivar(cultivar_id: int):
    cultivar = Cultivar.query.get_or_404(cultivar_id)
    db.session.delete(cultivar)
    db.session.commit()
    flash("Cultivar deleted.", "success")
    return redirect(url_for("index"))


@app.route("/care_logs/<int:log_id>/delete", methods=["POST"])
def delete_care_log(log_id: int):
    care_log = CareLog.query.get_or_404(log_id)
    cultivar_id = care_log.cultivar_id
    db.session.delete(care_log)
    db.session.commit()
    flash("Care log deleted.", "success")
    return redirect(url_for("show_cultivar", cultivar_id=cultivar_id))


if __name__ == "__main__":
    app.run(debug=True)
