const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

const PORT = 3000;

app.use(express.static(__dirname));

app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(function(error) {

    if (error) {

        console.log(
            "MySQL connection failed:",
            error.message
        );

        return;
    }

    console.log(
        "MySQL connected successfully!"
    );

});


app.get("/", function(req, res) {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


app.get("/api/questions/:category", function(req, res) {

    const category =
        req.params.category;

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

    db.query(
        sql,
        [category],
        function(error, rows) {

            if (error) {

                console.log(
                    "Database error:",
                    error.message
                );

                res.status(500).json({
                    error:
                        "Unable to load questions"
                });

                return;
            }

            const questions =
                rows.map(function(row) {

                    return {

                        question:
                            row.question,

                        options: [
                            row.option1,
                            row.option2,
                            row.option3,
                            row.option4
                        ],

                        answer:
                            row.answer

                    };

                });

            res.json(questions);

        }
    );

});


app.post("/api/signup", async function(req, res) {

    const name =
        req.body.name;

    const email =
        req.body.email;

    const password =
        req.body.password;


    if (!name || !email || !password) {

        res.status(400).json({
            message:
                "All fields are required"
        });

        return;
    }


    try {

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const sql = `
            INSERT INTO users
            (name, email, password)
            VALUES (?, ?, ?)
        `;


        db.query(
            sql,
            [
                name,
                email,
                hashedPassword
            ],
            function(error) {

                if (error) {

                    if (
                        error.code ===
                        "ER_DUP_ENTRY"
                    ) {

                        res.status(400).json({
                            message:
                                "Email already registered"
                        });

                        return;
                    }


                    console.log(
                        "Signup database error:",
                        error.message
                    );


                    res.status(500).json({
                        message:
                            "Database error"
                    });

                    return;

                }


                res.json({
                    message:
                        "Signup successful"
                });

            }
        );

    } catch (error) {

        console.log(
            "Signup error:",
            error.message
        );

        res.status(500).json({
            message:
                "Server error"
        });

    }

});


app.post("/api/login", function(req, res) {

    const email =
        req.body.email;

    const password =
        req.body.password;


    if (!email || !password) {

        res.status(400).json({
            message:
                "Email and password are required"
        });

        return;
    }


    const sql = `
        SELECT
            id,
            name,
            email,
            password
        FROM users
        WHERE email = ?
    `;


    db.query(
        sql,
        [email],
        async function(error, rows) {

            if (error) {

                console.log(
                    "Login database error:",
                    error.message
                );

                res.status(500).json({
                    message:
                        "Database error"
                });

                return;
            }


            if (rows.length === 0) {

                res.status(401).json({
                    message:
                        "Invalid email or password"
                });

                return;
            }


            const user =
                rows[0];


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                res.status(401).json({
                    message:
                        "Invalid email or password"
                });

                return;
            }


            res.json({

                message:
                    "Login successful",

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    email:
                        user.email

                }

            });

        }
    );

});


app.post(
    "/api/quiz-attempt",
    function(req, res) {

        const userId =
            req.body.userId;

        const category =
            req.body.category;

        const score =
            req.body.score;

        const totalQuestions =
            req.body.totalQuestions;


        if (
            !userId ||
            !category ||
            score === undefined ||
            !totalQuestions
        ) {

            res.status(400).json({
                message:
                    "Missing quiz data"
            });

            return;
        }


        const sql = `
            INSERT INTO quiz_attempts
            (
                user_id,
                category,
                score,
                total_questions
            )
            VALUES (?, ?, ?, ?)
        `;


        db.query(
            sql,
            [
                userId,
                category,
                score,
                totalQuestions
            ],
            function(error) {

                if (error) {

                    console.log(
                        "Quiz attempt database error:",
                        error.message
                    );

                    res.status(500).json({
                        message:
                            "Unable to save quiz result"
                    });

                    return;
                }


                res.json({
                    message:
                        "Quiz result saved successfully"
                });

            }
        );

    }
);


app.get(
    "/api/leaderboard",
    function(req, res) {

        const sql = `
            SELECT
                u.id,
                u.name,
                MAX(qa.score) AS score,
                MAX(qa.total_questions)
                    AS total_questions
            FROM users u
            INNER JOIN quiz_attempts qa
                ON u.id = qa.user_id
            GROUP BY
                u.id,
                u.name
            ORDER BY score DESC
            LIMIT 10
        `;


        db.query(
            sql,
            function(error, rows) {

                if (error) {

                    console.log(
                        "Leaderboard database error:",
                        error.message
                    );

                    res.status(500).json({
                        message:
                            "Unable to load leaderboard"
                    });

                    return;
                }


                const leaderboard =
                    rows.map(function(row) {

                        return {

                            id:
                                row.id,

                            name:
                                row.name,

                            score:
                                row.score,

                            total:
                                row.total_questions,

                            percentage:
                                Math.round(
                                    (
                                        row.score /
                                        row.total_questions
                                    ) * 100
                                )

                        };

                    });


                res.json(leaderboard);

            }
        );

    }
);


app.listen(
    PORT,
    function() {

        console.log(
            "QuizNova server running on http://localhost:" +
            PORT
        );

    }
);