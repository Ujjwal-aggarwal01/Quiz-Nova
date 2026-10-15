let selectedCategory = localStorage.getItem("selectedCategory");

let questions = [];

let currentQuestion = 0;
let score = 0;
let timeLeft = 30;
let timer;

const questionElement =
    document.getElementById("question");

const optionButtons =
    document.getElementsByClassName("option");

const progressBar =
    document.getElementById("progress-bar");

const timerElement =
    document.getElementById("timer");

const questionNumber =
    document.getElementById("question-number");

const categoryName =
    document.getElementById("category-name");


if (questionElement && optionButtons.length === 4) {

    if (!selectedCategory) {

        alert("Please select a category first.");

        window.location.href = "category.html";

    } else {

        localStorage.setItem(
            "category",
            selectedCategory
        );

        loadQuestions();

    }

}


function loadQuestions() {

    fetch("/api/questions/" + selectedCategory)

        .then(function(response) {

            if (!response.ok) {

                throw new Error(
                    "Questions could not be loaded"
                );

            }

            return response.json();

        })

        .then(function(data) {

            questions = data;

            questions.sort(function() {

                return Math.random() - 0.5;

            });

            questions =
                questions.slice(0, 10);

            if (categoryName) {

                if (selectedCategory === "math") {

                    categoryName.textContent =
                        "🧮 Mathematics";

                }

                else if (
                    selectedCategory === "programming"
                ) {

                    categoryName.textContent =
                        "💻 Programming";

                }

                else if (
                    selectedCategory === "ds"
                ) {

                    categoryName.textContent =
                        "🗂️ Data Structures";

                }

                else if (
                    selectedCategory === "gk"
                ) {

                    categoryName.textContent =
                        "🌎 General Knowledge";

                }

            }

            if (questions.length === 0) {

                alert(
                    "No questions found for this category."
                );

                window.location.href =
                    "category.html";

                return;

            }

            loadQuestion();

            startTimer();

        })

        .catch(function(error) {

            console.log(error);

            alert(
                "Unable to load quiz questions."
            );

        });

}


function loadQuestion() {

    questionElement.textContent =
        questions[currentQuestion].question;

    if (questionNumber) {

        questionNumber.textContent =
            currentQuestion + 1;

    }

    for (let i = 0; i < 4; i++) {

        optionButtons[i].textContent =
            questions[currentQuestion].options[i];

        optionButtons[i].disabled =
            false;

        optionButtons[i].style.backgroundColor =
            "";

        optionButtons[i].onclick =
            function() {

                checkAnswer(i);

            };

    }

    if (progressBar) {

        progressBar.style.width =
            ((currentQuestion + 1) /
                questions.length) * 100 + "%";

    }

    timeLeft = 30;

    if (timerElement) {

        timerElement.textContent =
            timeLeft;

    }

}


function checkAnswer(index) {

    let correct =
        questions[currentQuestion].options[index] ===
        questions[currentQuestion].answer;

    if (correct) {

        score++;

        optionButtons[index].style.backgroundColor =
            "lightgreen";

    }

    else {

        optionButtons[index].style.backgroundColor =
            "lightcoral";

        for (let i = 0; i < 4; i++) {

            if (
                questions[currentQuestion].options[i] ===
                questions[currentQuestion].answer
            ) {

                optionButtons[i].style.backgroundColor =
                    "lightgreen";

            }

        }

    }

    for (
        let i = 0;
        i < optionButtons.length;
        i++
    ) {

        optionButtons[i].disabled = true;

    }

    clearInterval(timer);

    setTimeout(function() {

        nextQuestion();

    }, 1000);

}


function nextQuestion() {

    currentQuestion++;

    if (currentQuestion >= questions.length) {

        clearInterval(timer);

        localStorage.setItem(
            "score",
            score
        );

        localStorage.setItem(
            "totalQuestions",
            questions.length
        );

        localStorage.setItem(
            "category",
            selectedCategory
        );

        sessionStorage.setItem(
            "currentAttempt",
            Date.now().toString()
        );

        window.location.href =
            "result.html";

        return;

    }

    loadQuestion();

    startTimer();

}


function startTimer() {

    clearInterval(timer);

    timer = setInterval(function() {

        timeLeft--;

        if (timerElement) {

            timerElement.textContent =
                timeLeft;

        }

        if (timeLeft <= 0) {

            clearInterval(timer);

            nextQuestion();

        }

    }, 1000);

}