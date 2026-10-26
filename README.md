# Apex Motor House

A premium, responsive showroom demo built with Flask, HTML, CSS, vanilla JavaScript, and separate JSON data files. Listings and contact details are sample data, not an offer or confirmation of availability.

## Run on Windows

From this project folder, install Flask and start the local server:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:8000** and keep the Python terminal running while browsing. Stop it with `Ctrl+C`.

## Project map

- `app.py` serves the pages and JSON API; it validates and saves form submissions.
- `data/cars.json` contains 12 sample vehicles and their specifications, features, and image galleries.
- `data/settings.json` contains showroom copy, demo contact details, hours, social links, and theme values.
- `data/bookings.json` and `data/messages.json` store accepted test-drive and contact requests.
- `templates/` contains the shared layout, home, inventory, vehicle detail, about, contact, and 404 pages.
- `static/css/` contains the visual system, responsive rules, and animations.
- `static/js/` contains shared interactions, inventory, forms, and vehicle detail behavior.
- `tests/test_app.py` covers page routes, API filters, form validation/storage, and security headers.

## Implemented

- API-backed featured vehicles, search and filters for marque, price, fuel, transmission, and year; price/year/name sorting; pagination; and grid/list view.
- Dynamic vehicle detail pages with image gallery, specifications, similar cars, and a finance estimate. The estimate uses 20% down, 7.5% APR, and the selected term by default; it is illustrative, not a financing offer.
- Browser-based wishlist and up-to-three-car comparison using local storage.
- Test-drive requests and contact messages validated in the browser and backend, then appended to JSON with a generated reference. A success is shown only after Flask confirms it saved.
- Responsive navigation, accessible form feedback, scroll reveals, testimonial controls, count-up statistics, and reduced-motion support.

## Edit the demo data

Update a car object in `data/cars.json` to change its price, specs, gallery, or sample availability wording. Update `data/settings.json` to change the showroom name, contact details, hours, links, hero copy, and theme values. Keep both files valid JSON. Photos use remote Unsplash URLs and need an internet connection.

## Tests

```powershell
python -m unittest discover -s tests -v
```

## Production note

This is a local demo. JSON files are convenient for learning and small single-process experiments, but they are not a production database: concurrent workers, backups, access control, email delivery, real finance quotes, inventory verification, and privacy/retention policies need production-grade services. Replace sample contact details and verify every vehicle before presenting listings publicly.