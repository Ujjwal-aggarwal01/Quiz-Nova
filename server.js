
const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const requiredEnv = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

const missingEnv = requiredEnv.filter(function(key) {
    return !process.env[key];
});

let db = null;
let dbReady = false;

if (missingEnv.length > 0) {
    console.error(
        "Missing database environment variables:",
        missingEnv.join(", ")
    );
} else {
    db = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000,
        enableKeepAlive: true
    });

    db.getConnection(function(error, connection) {
        if (error) {
            console.error(
                "MySQL connection failed:",
                error.code || "",
                error.message
            );
            return;
        }

        dbReady = true;

        console.log("MySQL connected successfully!");

        connection.release();
    });
}

function queryDatabase(sql, values, callback) {
    if (!db) {
        const error = new Error(
            "Database environment variables are missing"
        );

        error.code = "DB_CONFIG_MISSING";

        callback(error);
        return;
    }

    db.query(sql, values, function(error, results) {
        if (error) {
            console.error(
                "Database query failed:",
                error.code || "",
                error.message
            );
        }

        callback(error, results);
    });
}

function databaseError(res, error, message) {
    if (error.code === "DB_CONFIG_MISSING") {
        return res.status(503).json({
            message: "Database is not configured"
        });
    }

    return res.status(500).json({
        message: message
    });
}

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/questions/:category", function(req, res) {
    const category = req.params.category;

    const sql = `
        SELECT
            question,
            option1,
            option2,
            option3,
            option4,
            answer
        FROM questions
        WHERE category = ?
    `;

    queryDatabase(sql, [category], function(error, rows) {
        if (error) {
            return databaseError(
                res,
                error,
                "Unable to load questions"
            );
        }

        const questions = rows.map(function(row) {
            return {
                question: row.question,
                options: [
                    row.option1,
                    row.option2,
                    row.option3,
                    row.option4
                ],
                answer: row.answer
            };
        });

        res.json(questions);
    });
});

app.post("/api/signup", async function(req, res) {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `;

        queryDatabase(
            sql,
            [name, email, hashedPassword],
            function(error) {
                if (error) {
                    if (error.code === "ER_DUP_ENTRY") {
                        return res.status(400).json({
                            message: "Email already registered"
                        });
                    }

                    return databaseError(
                        res,
                        error,
                        "Database error"
                    );
                }

                res.json({
                    message: "Signup successful"
                });
            }
        );
    } catch (error) {
        console.error("Signup error:", error.message);

        res.status(500).json({
            message: "Server error"
        });
    }
});

app.post("/api/login", function(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const sql = `
        SELECT id, name, email, password
        FROM users
        WHERE email = ?
    `;

    queryDatabase(sql, [email], async function(error, rows) {
        if (error) {
            return databaseError(
                res,
                error,
                "Database error"
            );
        }

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = rows[0];

        try {
            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            res.json({
                message: "Login successful",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error("Login error:", error.message);

            res.status(500).json({
                message: "Server error"
            });
        }
    });
});

app.post("/api/quiz-attempt", function(req, res) {
    const userId = req.body.userId;
    const category = req.body.category;
    const score = req.body.score;
    const totalQuestions = req.body.totalQuestions;

    if (
        !userId ||
        !category ||
        score === undefined ||
        !Number.isFinite(score) ||
        !Number.isInteger(totalQuestions) ||
        totalQuestions <= 0 ||
        score < 0 ||
        score > totalQuestions
    ) {
        return res.status(400).json({
            message: "Invalid or missing quiz data"
        });
    }

    const sql = `
        INSERT INTO quiz_attempts
        (user_id, category, score, total_questions)
        VALUES (?, ?, ?, ?)
    `;

    queryDatabase(
        sql,
        [userId, category, score, totalQuestions],
        function(error) {
            if (error) {
                return databaseError(
                    res,
                    error,
                    "Unable to save quiz result"
                );
            }

            res.json({
                message: "Quiz result saved successfully"
            });
        }
    );
});

app.get("/api/leaderboard", function(req, res) {
    const sql = `
        SELECT
            u.id,
            u.name,
            MAX(qa.score) AS score,
            MAX(qa.total_questions) AS total_questions
        FROM users u
        INNER JOIN quiz_attempts qa
            ON u.id = qa.user_id
        GROUP BY u.id, u.name
        ORDER BY score DESC
        LIMIT 10
    `;

    queryDatabase(sql, [], function(error, rows) {
        if (error) {
            return databaseError(
                res,
                error,
                "Unable to load leaderboard"
            );
        }

        const leaderboard = rows.map(function(row) {
            return {
                id: row.id,
                name: row.name,
                score: row.score,
                total: row.total_questions,
                percentage: row.total_questions
                    ? Math.round(
                        (row.score / row.total_questions) * 100
                    )
                    : 0
            };
        });

        res.json(leaderboard);
    });
});

app.get("/api/health", function(req, res) {
    if (!db) {
        return res.status(503).json({
            status: "error",
            message: "Database environment variables are missing"
        });
    }

    db.query("SELECT 1", function(error) {
        if (error) {
            return res.status(503).json({
                status: "error",
                message: "Database connection unavailable"
            });
        }

        dbReady = true;

        res.json({
            status: "ok",
            database: "connected"
        });
    });
});

app.listen(PORT, "0.0.0.0", function() {
    console.log("QuizNova server running on port " + PORT);

    if (!db) {
        console.error(
            "QuizNova database is not configured. Check Render Environment."
        );
    }
});

