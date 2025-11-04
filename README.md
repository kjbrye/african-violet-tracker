# African Violet Tracker

A simple Flask web app to track your African violet cultivars and their care history. Add cultivar details, record watering or fertilizing, and review recent actions in one place.

## Features

- Add cultivars with details like flower color, light preference, and soil mix
- Log care actions (watering, fertilizing, grooming, etc.) for each plant
- Review care history per cultivar and see the most recent action at a glance
- Delete cultivars or individual care logs when you no longer need them

## Getting started

1. Create and activate a virtual environment (optional but recommended):

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Start the development server:

   ```bash
   flask --app app run --debug
   ```

   The app stores data in `violets.db` in the project root. The database will be created automatically on first run.

4. Open [http://localhost:5000](http://localhost:5000) in your browser to add cultivars and track care.

## Project structure

```
.
├── app.py              # Flask application and routes
├── requirements.txt    # Python dependencies
├── static/
│   └── styles.css      # App styling
└── templates/          # HTML templates for pages
```

## Development notes

- SQLite is used for persistence, so no additional database setup is needed.
- Flask's `SECRET_KEY` can be overridden via the `FLASK_SECRET_KEY` environment variable for production deployments.
