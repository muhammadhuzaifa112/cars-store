import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import app as showroom


ROOT = Path(__file__).resolve().parents[1]


class ShowroomTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        cars = (ROOT / "data" / "cars.json").read_text(encoding="utf-8")
        settings = (ROOT / "data" / "settings.json").read_text(encoding="utf-8")
        (self.data_dir / "cars.json").write_text(cars, encoding="utf-8")
        (self.data_dir / "settings.json").write_text(settings, encoding="utf-8")
        (self.data_dir / "bookings.json").write_text("[]", encoding="utf-8")
        (self.data_dir / "messages.json").write_text("[]", encoding="utf-8")
        self.data_patch = patch.object(showroom, "DATA_DIR", self.data_dir)
        self.data_patch.start()
        self.client = showroom.app.test_client()

    def tearDown(self):
        self.data_patch.stop()
        self.temp_dir.cleanup()

    def test_pages_and_custom_not_found(self):
        for path in ("/", "/inventory", "/cars/911-carrera-gts", "/about", "/contact"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.get("/not-a-page").status_code, 404)

    def test_inventory_api_and_filters(self):
        response = self.client.get("/api/cars")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["total"], 12)
        self.assertTrue(response.json["sample_data"])

        filtered = self.client.get("/api/cars?brand=porsche&min_price=150000&sort=price-low")
        self.assertEqual(filtered.json["total"], 2)
        self.assertTrue(all(car["brand"] == "Porsche" for car in filtered.json["cars"]))
        self.assertEqual(self.client.get("/api/cars/not-a-car").status_code, 404)

    def test_booking_validation_and_persistence(self):
        invalid = self.client.post("/api/bookings", json={})
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("email", invalid.json["fields"])

        response = self.client.post("/api/bookings", json={
            "name": "Alex Driver",
            "email": "alex@example.com",
            "phone": "5551234567",
            "car_id": "911-carrera-gts",
            "date": (date.today() + timedelta(days=1)).isoformat(),
            "time": "10:30",
            "message": "Please call before the visit.",
        })
        self.assertEqual(response.status_code, 201)
        records = json.loads((self.data_dir / "bookings.json").read_text(encoding="utf-8"))
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["reference"], response.json["reference"])

    def test_contact_validation_and_persistence(self):
        invalid = self.client.post("/api/contact", json={"name": "A", "email": "bad", "message": "short"})
        self.assertEqual(invalid.status_code, 400)

        response = self.client.post("/api/contact", json={
            "name": "Casey Client",
            "email": "casey@example.com",
            "subject": "Vehicle question",
            "message": "Could you share more information about this sample listing?",
        })
        self.assertEqual(response.status_code, 201)
        records = json.loads((self.data_dir / "messages.json").read_text(encoding="utf-8"))
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["email"], "casey@example.com")

    def test_security_headers(self):
        response = self.client.get("/")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])


if __name__ == "__main__":
    unittest.main()