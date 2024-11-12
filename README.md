# AnkiGenius - Flashcard Generator
#### Video Demo: https://youtu.be/mZ1bDeWnJvM?feature=shared
#### Description:
AnkiGenius is a web-based flashcard generator designed to make it easier to create Anki flashcards for studying. By leveraging Google’s Generative AI API, the app lets users generate both **basic** and **cloze** cards from prompts, saving time and making flashcard creation more efficient. Users simply input a prompt, and AnkiGenius generates a set of flashcards and offering an option to add them directly to an Anki deck. This project is built using JavaScript, with a core emphasis on integrating with Google Generative AI and Anki's API for seamless flashcard management.

### Project Structure

The project includes the following files and folders:

- **package.json**: Contains metadata about the project and its dependencies.
- **webpack.config.js**: A configuration file for bundling the app using Webpack.
- **README.md**: This file, which provides a comprehensive overview of the project.
- **/src**:
  - **index.js**: The main JavaScript file containing the core functionality of the application, including API calls and DOM manipulation.
- **/dist**:
  - **index.html**: The HTML template for the app’s user interface.
  - **styles.css**: The main stylesheet for styling the user interface.

### Code Overview

The core logic of the application is implemented in `index.js`, including the following key sections:

1. **Imports and Configurations**:
   - The app imports `GoogleGenerativeAI` from the `@google/generative-ai` package, setting up a connection to Google’s Generative AI API.
   - `basic_card` and `cloze_card` are objects used to define the types of flashcards that can be generated.

2. **Google Generative AI Setup**:
   - The app initializes an instance of Google’s Generative AI model with `gemini-1.5-flash`, specifying the types of cards (`basic_card` and `cloze_card`) it can generate.
   - Functions are mapped to handle the different card types (`displayBasicCards` for basic cards and `displayClozeCards` for cloze cards), ensuring that each type of card is rendered correctly.

3. **Function Definitions for Card Handling**:
   - **`displayBasicCards()`**: Processes and displays basic flashcards by creating HTML elements for each card's front and back sides.
   - **`displayClozeCards()`**: Processes and displays cloze cards, which contain text with cloze deletions.
   - **`displayError()`**: Provides user feedback on unsupported card types or connectivity issues with Anki.

4. **Core Functionality - `generateContent()`**:
   - This function takes a user prompt and sends it to the generative model. Based on the model’s response, it triggers the appropriate display function for the card type.

5. **Utility Functions**:
   - `clearContainer()`: Clears any existing content from the specified container to prevent duplicates.
   - `createCardHtml()` and `createClozeCardHtml()`: Create HTML elements for displaying each type of flashcard.

6. **Event Listeners**:
   - **`setupEventListeners()`**: Sets up a click event listener on the "Generate Flashcards" button, allowing users to initiate the card generation process.
   - **`handleGenerateClick()`**: Processes the text input from the user, ensuring that only prompts with content are submitted.

7. **Anki Integration**:
   - **`loadAnki()`**: Fetches deck names from Anki and displays them in a dropdown. If the fetch fails, an error is displayed with a retry button.
   - **`card_add_test()`**: Responsible for adding each card to Anki, depending on whether it’s a basic or cloze card. If any error occurs while adding a card, it is logged for troubleshooting.

### HTML Structure

The `index.html` file sets up the basic structure of the app with a simple user interface:

- A text area for entering prompts.
- A button to initiate the flashcard generation.
- Containers (`cardContainer` and `anki`) to display generated cards and Anki deck options.

### Styling

Basic styles are defined in `styles.css` for elements like buttons, containers, and flashcards. The layout is kept simple and user-friendly to prioritize functionality.

### Design Choices

1. **Generative AI Integration**:
   - Chose Google Generative AI for its powerful natural language processing capabilities. This allows users to generate meaningful flashcards from complex prompts, enhancing learning efficiency.

2. **Minimalistic Interface**:
   - Focused on a straightforward design for ease of use. Users are only required to enter a prompt, review the generated flashcards, and select the Anki deck for saving the cards.

3. **Error Handling**:
   - Designed the `displayError()` function to handle various issues, from unsupported card types to connectivity issues with Anki. This ensures the user experience is as seamless as possible.

4. **Modular Code Structure**:
   - Separated functionalities into distinct functions (`displayBasicCards`, `displayClozeCards`, etc.) for ease of maintenance and readability.


AnkiGenius is a lightweight, effective flashcard creation tool that combines the power of AI with a user-friendly interface, offering a streamlined approach to learning with Anki.
