import json
import re
import tempfile
import threading
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import Flask, abort, jsonify, render_template, request


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
_data_lock = threading.RLock()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024


def read_data(filename):
    path = DATA_DIR / filename
    with _data_lock:
        with path.open("r", encoding="utf-8") as data_file:
            return json.load(data_file)


def write_records(filename, records):
    path = DATA_DIR / filename
    with _data_lock:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=DATA_DIR, delete=False, suffix=".tmp"
        ) as temporary_file:
            json.dump(records, temporary_file, ensure_ascii=False, indent=2)
            temporary_file.write("\n")
            temporary_path = Path(temporary_file.name)
        temporary_path.replace(path)


def append_record(filename, record):
    with _data_lock:
        records = read_data(filename)
        records.append(record)
        write_records(filename, records)


def get_cars():
    return read_data("cars.json")


def find_car(slug):
    return next((car for car in get_cars() if car["id"] == slug), None)


def clean_text(value, maximum):
    if not isinstance(value, str):
        return ""
    return value.strip()[:maximum]


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' https://images.unsplash.com https://*.unsplash.com data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; script-src 'self'; "
        "connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    )
    return response


@app.get("/")
def home():
    return render_template("index.html", settings=read_data("settings.json"))


@app.get("/inventory")
def inventory():
    return render_template("inventory.html", settings=read_data("settings.json"))


@app.get("/cars/<slug>")
def car_details(slug):
    car = find_car(slug)
    if car is None:
        abort(404)
    return render_template("car-details.html", car=car, settings=read_data("settings.json"))


@app.get("/about")
def about():
    return render_template("about.html", settings=read_data("settings.json"))


@app.get("/contact")
def contact():
    return render_template("contact.html", settings=read_data("settings.json"))


@app.get("/api/cars")
def cars_api():
    cars = get_cars()
    brand = request.args.get("brand", "").strip().casefold()
    fuel = request.args.get("fuel", "").strip().casefold()
    transmission = request.args.get("transmission", "").strip().casefold()
    query = request.args.get("q", "").strip().casefold()

    def number_arg(name, fallback):
        try:
            value = request.args.get(name, "").strip()
            return float(value) if value else fallback
        except ValueError:
            return fallback

    minimum = number_arg("min_price", 0)
    maximum = number_arg("max_price", float("inf"))
    year = request.args.get("year", "").strip()
    results = []
    for car in cars:
        searchable = f"{car['brand']} {car['model']} {car['year']}".casefold()
        if brand and car["brand"].casefold() != brand:
            continue
        if fuel and car["fuel_type"].casefold() != fuel:
            continue
        if transmission and car["transmission"].casefold() != transmission:
            continue
        if query and query not in searchable:
            continue
        if not minimum <= car["price"] <= maximum:
            continue
        if year and str(car["year"]) != year:
            continue
        results.append(car)

    sort = request.args.get("sort", "featured")
    if sort == "price-low":
        results.sort(key=lambda car: car["price"])
    elif sort == "price-high":
        results.sort(key=lambda car: car["price"], reverse=True)
    elif sort == "year":
        results.sort(key=lambda car: car["year"], reverse=True)
    elif sort == "name":
        results.sort(key=lambda car: (car["brand"], car["model"]))
    return jsonify({"cars": results, "total": len(results), "sample_data": True})


@app.get("/api/cars/<slug>")
def car_api(slug):
    car = find_car(slug)
    if car is None:
        return jsonify({"error": "Car not found"}), 404
    return jsonify(car)


@app.post("/api/bookings")
def create_booking():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send the booking as JSON."}), 400

    name = clean_text(payload.get("name"), 100)
    email = clean_text(payload.get("email"), 254).lower()
    phone = clean_text(payload.get("phone"), 30)
    car_id = clean_text(payload.get("car_id"), 80)
    preferred_date = clean_text(payload.get("date"), 10)
    preferred_time = clean_text(payload.get("time"), 10)
    message = clean_text(payload.get("message", ""), 1000)
    errors = {}

    if len(name) < 2:
        errors["name"] = "Enter your name."
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        errors["email"] = "Enter a valid email address."
    if len(re.sub(r"\D", "", phone)) < 7:
        errors["phone"] = "Enter a valid phone number."
    car = find_car(car_id) if car_id else None
    if car is None:
        errors["car_id"] = "Choose a car from the collection."
    try:
        requested_day = date.fromisoformat(preferred_date)
        if requested_day < date.today():
            errors["date"] = "Choose today or a future date."
    except ValueError:
        errors["date"] = "Choose a valid date."
    if preferred_time not in {"09:00", "10:30", "12:00", "13:30", "15:00", "16:30"}:
        errors["time"] = "Choose an available appointment time."
    if errors:
        return jsonify({"error": "Please check the highlighted details.", "fields": errors}), 400

    booking = {
        "reference": uuid4().hex[:10].upper(),
        "name": name,
        "email": email,
        "phone": phone,
        "car_id": car_id,
        "car_name": f"{car['brand']} {car['model']}",
        "date": preferred_date,
        "time": preferred_time,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "request received; showroom confirmation required",
    }
    append_record("bookings.json", booking)
    return jsonify({"message": "Your request was received. The showroom will confirm by email.", "reference": booking["reference"]}), 201


@app.post("/api/contact")
def create_message():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send your message as JSON."}), 400

    name = clean_text(payload.get("name"), 100)
    email = clean_text(payload.get("email"), 254).lower()
    subject = clean_text(payload.get("subject", "Showroom enquiry"), 140)
    message = clean_text(payload.get("message"), 3000)
    errors = {}
    if len(name) < 2:
        errors["name"] = "Enter your name."
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        errors["email"] = "Enter a valid email address."
    if len(message) < 10:
        errors["message"] = "Please include a little more detail."
    if errors:
        return jsonify({"error": "Please check the highlighted details.", "fields": errors}), 400

    record = {
        "reference": uuid4().hex[:10].upper(),
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    append_record("messages.json", record)
    return jsonify({"message": "Your message was received.", "reference": record["reference"]}), 201


@app.errorhandler(404)
def not_found(_error):
    return render_template("404.html", settings=read_data("settings.json")), 404


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "The submitted request is too large."}), 413


@app.errorhandler(500)
def server_error(_error):
    return jsonify({"error": "The request could not be completed. Please try again."}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False, threaded=True)