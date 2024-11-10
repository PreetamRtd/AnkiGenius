import { GoogleGenerativeAI } from "@google/generative-ai";

// Function declaration, to pass to the model.
const basic_card = {
    name: "basic_card",
    parameters: {
        type: "OBJECT",
        description: "Create a list of Anki basic cards with front and back pairs.",
        properties: {
            cards: {
                type: "ARRAY",
                description: "A list of Anki basic cards.",
                items: {
                    type: "OBJECT",
                    properties: {
                        front: {
                            type: "STRING",
                            description: "Provide a concise question that requires a specific answer or explanation."
                        },
                        back: {
                            type: "STRING",
                            description: "Provide the answer or explanation to the question for the front of the card."
                        }
                    },
                    required: ["front", "back"]
                }
            }
        },
        required: ["cards"]
    }
};

const cloze_card = {
    name: "cloze_card",
    parameters: {
        type: "OBJECT",
        description: "Create a list of Anki cloze cards with cloze deletions.",
        properties: {
            cards: {
                type: "ARRAY",
                description: "A list of Anki cloze cards.",
                items: {
                    type: "OBJECT",
                    properties: {
                        text: {
                            type: "STRING",
                            description: "Provide a concise cloze deletions on important keywords. Format: '{{c1::text}}'"
                        }
                    },
                    required: ["text"]
                }
            }
        },
        required: ["cards"]
    }
};

// API Key and Model Constants
const API_KEY = process.env.API_KEY;
let modelName = "none";
let deckName = "none";
let ankiCards = [];

// Google Generative AI Client Setup
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", tools: { functionDeclarations: [basic_card, cloze_card] } });

// Function Definitions for Card Handling
const functions = {
    basic_card: displayBasicCards,
    cloze_card: displayClozeCards
};

function displayBasicCards({ cards }) {
    ankiCards = cards;
    modelName = "Basic";
    const cardContainer = document.getElementById('cardContainer');
    clearContainer(cardContainer);
    cards.forEach(card => {
        const br = document.createElement('br');
        cardContainer.appendChild(br);
        cardContainer.appendChild(createCardHtml(card.front, card.back));
    });
}

function displayClozeCards({ cards }) {
    ankiCards = cards;
    modelName = "Cloze";
    const cardContainer = document.getElementById('cardContainer');
    clearContainer(cardContainer);
    cards.forEach(card => {
        const br = document.createElement('br');
        cardContainer.appendChild(br);
        cardContainer.appendChild(createClozeCardHtml(card.text));
    });
}

function displayError(message) {
    const container = document.getElementById(message === 0 ? 'cardContainer' : 'anki');
    const alertDiv = document.createElement('div');
    const ankiContainer = document.getElementById('anki');
    const br = document.createElement('br');

    message = message === 0
        ? "! Unsupported card type. Only Basic and Cloze cards are supported."
        : "An error occurred while connecting to Anki.";
    clearContainer(ankiContainer);  // Clear existing content to avoid duplicates
    clearContainer(container);
    alertDiv.className = 'alert';
    alertDiv.innerHTML = `<p><strong>${message}</strong></p>`;
    container.appendChild(br);
    container.appendChild(alertDiv);
}

// Example usage in your generateContent function
function generateContent(prompt) {
    model.generateContent(prompt)
        .then(result => {
            const call = result.response.functionCalls()[0];
            if (call) {
                functions[call.name](call.args);
            } else { displayError(0); }
        }).catch(error => { displayError(0); });
}


// Utility Functions
function clearContainer(container) {
    container.innerHTML = '';
}

function createCardHtml(front, back) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.innerHTML = `<p><strong>Front: </strong> ${front}</p><p><strong>Back: </strong> ${back}</p>`;
    return cardDiv;
}

function createClozeCardHtml(text) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.innerHTML = `<p><strong>Cloze: </strong> ${text}</p>`;
    return cardDiv;
}

// Event Listener Setup
function setupEventListeners() {
    document.getElementById("gen-card-btn").addEventListener("click", handleGenerateClick);
}

function handleGenerateClick() {
    const textareaValue = document.getElementById('textarea').value;
    if (textareaValue) generateContent(textareaValue);
    else console.log("Please enter a prompt.");
    loadAnki()
}

function handleAddCardClick() {
    deckName = document.getElementById("deck-select").value;
    deck_names();

}

function displaySubmitWithDropdown(decks) {
    const ankiContainer = document.getElementById('anki');
    clearContainer(ankiContainer);  // Clear existing content to avoid duplicates

    // Create dropdown for selecting a deck
    const deckSelect = document.createElement('select');
    deckSelect.id = 'deck-select';
    deckSelect.name = 'deckSelect';
    deckSelect.ariaLabel = 'Choose a deck';

    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck;
        option.textContent = deck;
        deckSelect.appendChild(option);
    });

    // Create submit button
    const submitButton = document.createElement('button');
    submitButton.className = 'button';
    submitButton.id = 'add-card-btn';
    submitButton.textContent = 'Add to Anki';

    // Append elements to the ankiContainer
    ankiContainer.appendChild(deckSelect);
    ankiContainer.appendChild(submitButton);

    // Add event listener for the submit button
    submitButton.addEventListener('click', handleAddCardClick);
}
function displayRetryButton() {
    const retryButton = document.createElement('button');
    const ankiContainer = document.getElementById('anki');
    retryButton.className = 'button';
    retryButton.id = 'retry';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener("click", loadAnki);
    ankiContainer.appendChild(retryButton);
}
function loadAnki() {
    fetch("http://localhost:8765", {
        method: "POST",
        body: JSON.stringify({ action: "deckNames", version: 6 }),
        headers: { "Content-Type": "application/json" }
    })
        .then(response => response.json())
        .then(data => {
            if (data.result) {
                displaySubmitWithDropdown(data.result);
            } else {
                displayError(1);
                displayRetryButton();
            }
        })
        .catch(error => {
            displayError(1);
            displayRetryButton();
            console.error("Error:", error);
        });
}

function createAnkiCards(deckName) {
    ankiCards.forEach(card => {
        fetch("http://localhost:8765", {
            method: "POST",
            body: JSON.stringify({
                action: "addNote",
                version: 6,
                params: {
                    note: {
                        deckName: deckName,
                        modelName: modelName,
                        fields: {
                            Front: card.front,
                            Back: card.back
                        }
                    }
                }
            }),
            headers: {
                "Content-Type": "application/json"
            }
        }).then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error("Error adding card:", data.error);
                } else {
                    console.log("Card added:", data);
                    alert("Card successfully added to " + deckName + " in model: " + modelName + " with tags: " + card.tags.join(', '));
                }
            }).catch(error => {
                console.error("Error:", error);
            });
    });
}

function deck_names() {
    ankiCards.forEach(card => {
        if (modelName == "Cloze") {
            fetch("http://localhost:8765", {
                method: "POST",
                body: JSON.stringify({
                    action: "addNote",
                    version: 6,
                    params: {
                        note: {
                            deckName: deckName,
                            modelName: "Cloze",
                            fields: {
                                Text: card.text
                            }
                        }
                    }
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error("Error adding card:", data.error);
                    } else {
                        console.log("Card added:", data);
                    }
                }).catch(error => {
                    console.error("Error:", error);
                });

            card.back = "none";
        } else {
            fetch("http://localhost:8765", {
                method: "POST",
                body: JSON.stringify({
                    action: "addNote",
                    version: 6,
                    params: {
                        note: {
                            deckName: deckName,
                            modelName: modelName,
                            fields: {
                                Front: card.front,
                                Back: card.back
                            }

                        }
                    }
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(response => response.json())
                .then(data => {
                    if (data.error) {

                        console.error("Error adding card: ", data.error);
                    } else {
                        console.log("Card added:", data);
                    }
                }).catch(error => {

                    console.error("Error: ", error);
                });
        };
    });
}

const textarea = document.querySelector("textarea");
textarea.addEventListener("keyup", e => {
    textarea.style.height = "63px";
    let scHeight = e.target.scrollHeight;
    textarea.style.height = `${scHeight}px`;
});


// Initialize
setupEventListeners();
