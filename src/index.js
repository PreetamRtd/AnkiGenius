import { GoogleGenerativeAI } from "@google/generative-ai";

// Function declaration, to pass to the model.
const basic_card = {
    "name": "basic_card",
    "parameters": {
        "type": "OBJECT",
        "description": "Create a list of Anki basic cards (front and back pairs). This is the default card type.",
        "properties": {
            "cards": {
                "type": "ARRAY",
                "description": "A list of Anki basic cards.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "front": {
                            "type": "STRING",
                            "description": "The 'front' of the flashcard. This should be a clear question, term, or prompt (e.g., 'What is the capital of France?')."
                        },
                        "back": {
                            "type": "STRING",
                            "description": "The 'back' of the flashcard. This provides the concise answer or explanation for the prompt on the 'front' (e.g., 'Paris')."
                        }
                    },
                    "required": ["front", "back"]
                }
            }
        },
        "required": ["cards"]
    }
}

const cloze_card = {
    "name": "cloze_card",
    "parameters": {
        "type": "OBJECT",
        "description": "Create a list of Anki cloze cards with cloze deletions. Use this only when specifically requested.",
        "properties": {
            "cards": {
                "type": "ARRAY",
                "description": "A list of Anki cloze cards.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "text": {
                            "type": "STRING",
                            "description": "The full text for a cloze deletion card. Use `{{c1::word}}` syntax to hide a keyword. Use `{{c2::another word}}` for a second, separate blank, and so on. (e.g., '{{c1::Paris}} is the capital of {{c2::France}}.')"
                        }
                    },
                    "required": ["text"]
                }
            }
        },
        "required": ["cards"]
    }
}

// API Key and Model Constants
const API_KEY = process.env.API_KEY;
let modelName = "none";
let deckName = "none";
let ankiCards = []; // Stores the currently generated cards
// NEW: Global variable to store the selected Gemini model
let currentGeminiModel = "gemini-2.5-flash"; // 'gemini-2.5-flash' or 'gemini-2.5-pro'

// Google Generative AI Client Setup
const genAI = new GoogleGenerativeAI(API_KEY);
// Note: Model initialization moved inside generateContent per previous request.

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

    loadAnki();
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

    loadAnki();
}

/**
 * Displays an error message in the appropriate container.
 * @param {'cardGeneration' | 'ankiConnection' | 'ankiAdd' | 'fileRead'} type - The type of error.
 * @param {string} [message=""] - An optional custom message.
 */
function displayError(type, message = "") {
    const cardContainer = document.getElementById('cardContainer');
    const ankiContainer = document.getElementById('anki');
    let container;
    let fullMessage;

    switch (type) {
        case 'cardGeneration':
            container = cardContainer;
            fullMessage = message || "! Unsupported card type or model response. Only Basic and Cloze cards are supported.";
            clearContainer(cardContainer); // Clear self
            clearContainer(ankiContainer); // Clear Anki UI
            break;
        case 'ankiConnection':
            container = ankiContainer;
            clearContainer(ankiContainer); // Clear self (e.g., "loading...")
            fullMessage = message || "Could not connect to Anki. Is AnkiConnect running?";
            break;
        case 'ankiAdd':
            container = ankiContainer;
            fullMessage = `Error adding cards: ${message}` || "An error occurred while adding cards.";
            clearContainer(ankiContainer); // Clear self
            break;
        // NEW: Case for file read errors
        case 'fileRead':
            container = cardContainer; // Show file errors in the main container
            fullMessage = `Error reading file: ${message}` || "An error occurred while reading the file.";
            // Don't clear Anki UI, just show the error
            clearContainer(cardContainer);
            break;
        default:
            container = cardContainer; // Default to card container
            fullMessage = message || "An unknown error occurred.";
            clearContainer(cardContainer);
            clearContainer(ankiContainer);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert'; // Assumes 'alert' is a defined CSS class
    alertDiv.innerHTML = `<p><strong>${fullMessage}</strong></p>`;

    if (type === 'cardGeneration' || type === 'fileRead') {
        container.appendChild(document.createElement('br'));
    }
    container.appendChild(alertDiv);

    // Add failure options for connection errors or show Anki UI again after an add error
    if (type === 'ankiConnection') {
        displayAnkiFailureOptions(); // Show retry/download
    } else if (type === 'ankiAdd') {
        // After an add error, reload the Anki UI so the user can try again
        setTimeout(loadAnki, 2500);
    }
}

/**
 * Displays a temporary success message in the Anki container.
 * @param {string} message - The success message to display.
 */
function displaySuccessMessage(message) {
    const ankiContainer = document.getElementById('anki');
    clearContainer(ankiContainer); // Clear dropdown and button

    const successDiv = document.createElement('div');
    successDiv.className = 'alert-success'; // Assumes 'alert-success' is a defined CSS class
    successDiv.innerHTML = `<p><strong>${message}</strong></p>`;
    ankiContainer.appendChild(successDiv);

    // After a short delay, reload the Anki UI
    setTimeout(loadAnki, 2500);
}

// Generate content via Gemini
function generateContent(prompt) {
    // Clear previous results and Anki UI
    clearContainer(document.getElementById('cardContainer'));
    clearContainer(document.getElementById('anki'));
    // Optionally, add a "Loading..." message to cardContainer
    const cardContainer = document.getElementById('cardContainer');
    cardContainer.innerHTML = '<p>Generating cards...</p>';


    // Model is defined inside the function
    const model = genAI.getGenerativeModel({
        // MODIFIED: Use the global variable for the model name
        model: currentGeminiModel, 
        tools: { functionDeclarations: [basic_card, cloze_card] }
    });

    model.generateContent(prompt)
        .then(result => {
            const calls = result.response.functionCalls();
            if (calls && calls.length > 0) {
                const call = calls[0]; // Process the first function call
                if (functions[call.name]) {
                    // This will call displayBasicCards or displayClozeCards,
                    // which will then call loadAnki()
                    functions[call.name](call.args);
                } else {
                    // Model called a function we don't have
                    displayError('cardGeneration', `Unsupported function call: ${call.name}`);
                }
            } else {
                // Model responded with text or nothing, not the expected function call
                displayError('cardGeneration');
            }
        }).catch(error => {
            console.error("Gemini API Error:", error);
            displayError('cardGeneration', 'An error occurred while generating content.');
        });
}

// Utility Functions
function clearContainer(container) {
    if (container) {
        container.innerHTML = '';
    }
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
// MODIFIED: Added listeners for new buttons
function setupEventListeners() {
    // Generate Card Button
    const genButton = document.getElementById("gen-card-btn");
    if (genButton) {
        genButton.addEventListener("click", handleGenerateClick);
    }

    // NEW: Model Toggle Button
    const modelToggleButton = document.getElementById("model-toggle-btn");
    if (modelToggleButton) {
        // Initialize button text based on the default model
        modelToggleButton.textContent = `Model: Flash`; 
        modelToggleButton.addEventListener("click", handleModelToggle);
    }

    // NEW: File Upload Input
    const fileUploadInput = document.getElementById("upload-file-input");
    if (fileUploadInput) {
        // Use 'change' event for file inputs
        fileUploadInput.addEventListener("change", handleFileUpload);
    }

    // Textarea auto-resize
    const textarea = document.querySelector("textarea");
    if (textarea) {
        textarea.addEventListener("keyup", e => {
            textarea.style.height = "63px"; // Reset height
            let scHeight = e.target.scrollHeight;
            textarea.style.height = `${scHeight}px`; // Set to scroll height
        });
    }
}

// Event Handlers
function handleGenerateClick() {
    const textareaValue = document.getElementById('textarea').value;
    if (textareaValue) {
        generateContent(textareaValue);
    } else {
        console.log("Please enter a prompt.");
        // Optionally, display a user-facing prompt
        displayError('cardGeneration', 'Please enter a prompt or upload a file.');
    }
}

function handleAddCardClick() {
    deckName = document.getElementById("deck-select").value;
    if (ankiCards.length === 0) {
        displayError('ankiAdd', 'No cards have been generated to add.');
        return;
    }
    addCardsToAnki(deckName);
}

// NEW: Event handler for the model toggle button
/**
 * Toggles the Gemini model between 'flash' and 'pro' and updates the button text.
 */
function handleModelToggle() {
    const modelToggleButton = document.getElementById("model-toggle-btn");
    if (currentGeminiModel === "gemini-2.5-flash") {
        currentGeminiModel = "gemini-2.5-pro";
        if (modelToggleButton) modelToggleButton.textContent = "Model: Pro";
    } else {
        currentGeminiModel = "gemini-2.5-flash";
        if (modelToggleButton) modelToggleButton.textContent = "Model: Flash";
    }
    console.log(`Model switched to: ${currentGeminiModel}`);
}

// NEW: Event handler for the file upload input
/**
 * Handles the file upload input 'change' event.
 * Reads the selected file as text and populates the textarea.
 * @param {Event} e - The file input change event.
 */
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        // Update visible filename to show no selection
        const nameElEmpty = document.querySelector('.upload-file-name');
        if (nameElEmpty) nameElEmpty.textContent = 'No file chosen';
        return; // No file selected
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        const fileContent = event.target.result;
        const textarea = document.getElementById('textarea');
        if (textarea) {
            textarea.value = fileContent;
            
            // Trigger the auto-resize logic to adjust height
            textarea.style.height = "63px";
            let scHeight = textarea.scrollHeight;
            textarea.style.height = `${scHeight}px`;
        }
    };

    reader.onerror = (error) => {
        console.error("Error reading file:", error);
        displayError('fileRead', error.message);
    };

    reader.readAsText(file);
    
    // Clear the file input value so the 'change' event fires
    // even if the same file is selected again.
    // Update the visible filename element
    const nameEl = document.querySelector('.upload-file-name');
    if (nameEl) nameEl.textContent = file.name || 'No file chosen';

    // Keep the input value cleared so re-selecting same file triggers 'change'
    e.target.value = null;
}


/**
 * Handles the CSV download logic by generating a CSV file from ankiCards.
 */
function handleDownloadCSV() {
    if (ankiCards.length === 0) {
        console.error("No cards to download.");
        // Optionally display an error to the user
        return;
    }

    let csvRows = [];
    let headers = [];

    // 1. Determine headers and rows based on card type
    if (modelName === "Cloze") {
        headers = ["Text"];
        // For Cloze, each row is just the escaped text
        csvRows = ankiCards.map(card => [escapeCSV(card.text)]);
    } else { // Default to "Basic"
        headers = ["Front", "Back"];
        // For Basic, each row is an array of [escaped_front, escaped_back]
        csvRows = ankiCards.map(card => [
            escapeCSV(card.front),
            escapeCSV(card.back)
        ]);
    }

    // 2. Join headers
    let csvContent = headers.join(",") + "\r\n";

    // 3. Join all rows
    csvRows.forEach(rowArray => {
        csvContent += rowArray.join(",") + "\r\n";
    });

    // 4. Create and trigger download link
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "anki_cards.csv");
    document.body.appendChild(link); // Required for Firefox compatibility

    link.click(); // Programmatically click the link to trigger the download

    document.body.removeChild(link); // Clean up the link
}

/**
 * Escapes a string for use in a CSV file according to RFC 4180.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
function escapeCSV(str) {
    if (str === null || str === undefined) {
        return "";
    }
    let result = String(str);
    
    // If the string contains a comma, newline, or double quote, it must be enclosed in double quotes.
    if (result.search(/("|,|\n)/g) >= 0) {
        // Double up any existing double quotes
        result = result.replace(/"/g, '""');
        // Enclose the entire field in double quotes
        result = `"${result}"`;
    }
    return result;
}


// AnkiConnect Functions
function displaySubmitWithDropdown(decks) {
    const ankiContainer = document.getElementById('anki');
    clearContainer(ankiContainer); // Clear existing content (like "loading..." or retry button)

    // Create dropdown
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

    ankiContainer.appendChild(deckSelect);
    ankiContainer.appendChild(submitButton);

    // Add event listener for the new button
    submitButton.addEventListener('click', handleAddCardClick);
}

/**
 * Displays failure options (Retry and Download CSV) in the Anki container
 * when a connection error occurs.
 */
function displayAnkiFailureOptions() {
    const ankiContainer = document.getElementById('anki');
    // The container should have already been cleared and had the error message
    // added by displayError('ankiConnection', ...). We just add buttons.

    // 1. Add Retry Button
    const retryButton = document.createElement('button');
    retryButton.className = 'button';
    retryButton.id = 'retry';
    retryButton.textContent = 'Retry Anki Connection';
    retryButton.addEventListener("click", loadAnki);
    ankiContainer.appendChild(retryButton);

    // 2. Add Download CSV Button
    const downloadButton = document.createElement('button');
    downloadButton.className = 'button';
    downloadButton.id = 'download-csv-btn';
    downloadButton.textContent = 'Download as CSV';
    // Add a little space between the buttons
    downloadButton.style.marginLeft = '10px'; 
    downloadButton.addEventListener("click", handleDownloadCSV);
    ankiContainer.appendChild(downloadButton);
}


function loadAnki() {
    // Clear Anki container and show loading
    const ankiContainer = document.getElementById('anki');
    clearContainer(ankiContainer);
    ankiContainer.innerHTML = '<p>Connecting to Anki...</p>';

    fetch("http://localhost:8765", {
        method: "POST",
        body: JSON.stringify({ action: "deckNames", version: 6 }),
        headers: { "Content-Type": "application/json" }
    })
    .then(response => response.json())
    .then(data => {
        if (data.result && data.result.length > 0) {
            displaySubmitWithDropdown(data.result);
        } else if (data.error) {
            displayError('ankiConnection', data.error);
        } else {
            displayError('ankiConnection', 'No decks found or AnkiConnect returned an unexpected result.');
        }
    })
    .catch(error => {
        console.error("Anki Connection Error:", error);
        displayError('ankiConnection'); // Call with default connection error message
    });
}

/**
 * Adds the globally stored 'ankiCards' to the selected Anki deck
 * in a single batch request.
 * @param {string} selectedDeckName - The name of the deck to add cards to.
 */
function addCardsToAnki(selectedDeckName) {
    // 1. Build the array of 'note' objects for the AnkiConnect API
    const notes = ankiCards.map(card => {
        let fields;
        // Set fields based on the modelName determined during card generation
        if (modelName === "Cloze") {
            fields = { "Text": card.text };
        } else { // Default to "Basic"
            fields = {
                "Front": card.front,
                "Back": card.back
            };
        }

        return {
            deckName: selectedDeckName,
            modelName: modelName,
            fields: fields,
            tags: [] // Add tags here if you want
        };
    });

    // 2. Send the single "addNotes" (plural) request
    fetch("http://localhost:8765", {
        method: "POST",
        body: JSON.stringify({
            action: "addNotes", // Use 'addNotes' (plural)
            version: 6,
            params: {
                notes: notes // Pass the entire array of notes
            }
        }),
        headers: { "Content-Type": "application/json" }
    })
    .then(response => response.json())
    .then(data => {
        // 3. Handle the response
        if (data.error) {
            console.error("Error adding cards:", data.error);
            displayError('ankiAdd', data.error);
        } else {
            // data.result is an array of note IDs, or null for failures
            const addedCount = data.result.filter(id => id !== null).length;
            const errorCount = data.result.length - addedCount;
            
            console.log("Cards added:", data.result);
            let successMsg = `Successfully added ${addedCount} cards to "${selectedDeckName}".`;
            if (errorCount > 0) {
                successMsg += ` (${errorCount} failed.)`;
            }
            displaySuccessMessage(successMsg);
        }
    })
    .catch(error => {
        console.error("Anki Add Fetch Error:", error);
        // This is likely a connection error (e.g., Anki was closed)
        displayError('ankiConnection', 'Failed to send cards to Anki.');
    });
}


// Initialize
setupEventListeners();