const mysql = require("mysql2");
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const categories = ["math", "programming", "ds", "gk"];

db.connect(function(error) {

    if (error) {
        console.log("MySQL connection failed:", error.message);
        return;
    }

    console.log("MySQL connected successfully!");

    let completed = 0;

    categories.forEach(function(category) {

        const filePath = path.join(
            __dirname,
            "questionbank",
            category + ".json"
        );

        const questions =
            JSON.parse(fs.readFileSync(filePath, "utf8")).slice(0,50);

        questions.forEach(function(q) {

            const sql = `
                INSERT INTO questions
                (category, question, option1, option2, option3, option4, answer)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    category,
                    q.question,
                    q.options[0],
                    q.options[1],
                    q.options[2],
                    q.options[3],
                    q.answer
                ],
                function(error) {

                    if (error) {
                        console.log("Insert error:", error.message);
                    }

                    completed++;

                    if (completed === 200) {
                        console.log("200 questions inserted into MySQL.");
                        db.end();
                    }

                }
            );

        });

    });

});
