export const DEMO_CODE = `#!/usr/bin/env python3
"""user_management.py — A deliberately vulnerable demo app."""

import os
import pickle
import hashlib
import sqlite3
import yaml
import requests
import jwt
from flask import Flask, request, jsonify

app = Flask(__name__)
app.debug = True

# Hardcoded secrets
API_KEY = "sk-proj-abc123XYZsecretKeyThatShouldNotBeHere99"
DB_PASSWORD = "SuperSecret_P@ssw0rd_2024!"
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"

# Database connection
conn = sqlite3.connect("users.db")
cursor = conn.cursor()


@app.route("/login", methods=["POST"])
def login():
    username = request.form["username"]
    password = request.form["password"]

    # SQL Injection — string concatenation in query
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    user = cursor.fetchone()

    if user:
        token = jwt.encode({"user": username}, "secret", algorithm="none")
        return jsonify({"token": token})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/profile/<user_id>")
def profile(user_id):
    # SSRF — user-controlled URL
    avatar_url = request.args.get("avatar_url")
    avatar = requests.get(avatar_url)

    # Path Traversal
    bio_file = request.args.get("bio_path")
    with open(bio_file, "r") as f:
        bio = f.read()

    return jsonify({"avatar": avatar.text, "bio": bio})


@app.route("/search")
def search():
    term = request.args.get("q")
    # XSS via response
    return f"<h1>Results for {term}</h1>"


@app.route("/admin/config", methods=["POST"])
def update_config():
    # Insecure deserialization
    config_data = request.data
    config = pickle.loads(config_data)

    # Command injection
    backup_name = request.form.get("backup_name")
    os.system(f"tar -czf /backups/{backup_name}.tar.gz /data")

    return jsonify({"status": "updated"})


@app.route("/export")
def export_data():
    fmt = request.args.get("format")
    data = request.args.get("data")

    # Eval injection
    result = eval(request.args.get("expression"))

    # Weak hashing
    user_hash = hashlib.md5(data.encode()).hexdigest()

    # YAML deserialization without safe loader
    parsed = yaml.load(data)

    return jsonify({"result": result, "hash": user_hash, "parsed": parsed})


# CORS wildcard
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
`;

export const DEMO_JS_CODE = `// payment-api.js — Demo vulnerable Node.js endpoint
const express = require('express');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

const app = express();
const SECRET = "my_jwt_secret_key_12345_production";
const API_KEY = "sk-live-4eC39HqLyjWDarjtT1zdp7dc";

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin123',
  database: 'payments'
});

// No auth middleware on sensitive route
app.post('/api/transfer', (req, res) => {
  const { from, to, amount } = req.body;

  // SQL Injection
  const query = "SELECT balance FROM accounts WHERE id='" + from + "'";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Command injection via user input
    exec(\`echo "Transfer \${amount} from \${from} to \${to}" >> /var/log/transfers.log\`);

    res.json({ status: 'success' });
  });
});

app.get('/api/user/:id', (req, res) => {
  // Path traversal
  const fs = require('fs');
  const data = fs.readFileSync(req.params.id + '.json');

  // XSS via innerHTML in response template
  const html = '<div>' + req.query.name + '</div>';
  document.innerHTML = html;

  res.json(JSON.parse(data));
});

// JWT with verify disabled
app.get('/api/admin', (req, res) => {
  const token = req.headers.authorization;
  const decoded = jwt.decode(token, { verify: false });
  res.json({ admin: decoded });
});

// Wildcard CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.listen(3000);
`;
