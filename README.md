
# LazyDesk AI 🧠

### Your local-first AI productivity assistant

LazyDesk AI is a lightweight productivity dashboard powered by open-source AI using Ollama. It helps users summarise information, turn notes into actionable tasks, organise filenames, and prepare a daily productivity brief.

The project uses only **HTML, CSS, and JavaScript** for its frontend, with Ollama running locally to provide AI capabilities.

## ✨ Features

- **Smart Summary:** Turn long notes and text into clear, concise summaries.
- **Auto Task Maker:** Convert notes into an actionable checklist.
- **File Organizer:** Get cleaner filename suggestions and export a rename plan.
- **Morning Brief:** Generate a daily focus brief from your pending tasks.
- **Local AI:** Connect to a model running on your own computer through Ollama.
- **Privacy-focused design:** Text sent to the AI goes to your configured local Ollama instance rather than a hosted AI API.
- **Responsive dashboard:** Use the interface on desktop and mobile-sized screens.
- **Dark mode:** Switch between light and dark themes.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Dashboard structure |
| CSS3 | Responsive layout and styling |
| JavaScript | UI interactions and AI requests |
| Ollama | Local model runtime |
| Qwen 2.5 3B | Suggested open-weight AI model |

## 📁 Project Structure

```text
LazyDesk-AI/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 🚀 Getting Started

### 1. Install Ollama

Download and install Ollama from:

https://ollama.com/download

### 2. Download an AI model

Open your terminal and run:

```bash
ollama pull qwen2.5:3b
```

Check your installed models:

```bash
ollama list
```

### 3. Start Ollama

Ollama normally runs as a background application. If it is not running, start its local service:

```bash
ollama serve
```

If the service is already running, you do not need to start it again.

### 4. Launch the frontend

Place `index.html`, `style.css`, and `script.js` in the same folder.

Open the folder in VS Code or Antigravity and launch `index.html` using a local development server, such as Live Server.

### 5. Connect to your local model

The default Ollama address is:

```text
http://localhost:11434
```

Open the Setup section in LazyDesk AI, test the connection, and select an installed model.

**Troubleshooting:** If the browser blocks the connection, configure Ollama's allowed origins for your local development server. Avoid exposing the Ollama API to the public internet.

## 🔒 Privacy and Security

LazyDesk AI is designed around local-first AI.

- AI prompts are sent to the Ollama endpoint configured in the application.
- The application does not require a hosted AI API key.
- File Organizer generates filename suggestions in the browser; it does not upload file contents or rename files automatically.
- Theme and connection settings may be stored in browser local storage.
- Local inference can reduce reliance on third-party AI services, but privacy depends on your model runtime, computer, browser, and any additional services you configure.

The current implementation does not provide a guarantee of zero network activity. For example, the stylesheet may load fonts from Google Fonts, and model downloads require an internet connection.

## 🌱 Why Open Innovation Matters

Open-source software and open-weight models make AI more accessible to students, developers, and independent builders.

LazyDesk AI demonstrates how developers can build useful AI tools without depending entirely on proprietary hosted AI APIs. By running an open-weight model locally, users can experiment with AI workflows, customise their setup, and maintain greater control over their data.

The project also encourages learning through transparent web technologies and a model runtime that developers can inspect and configure.

## 📴 Does It Work Without Internet?

**Potentially, yes, after setup.**

Once Ollama and the chosen model are installed, local inference can work without an internet connection. However, the current frontend may still request externally hosted fonts, and initial installation or model downloads require internet access.

For a fully offline experience, bundle or system-install the required fonts and avoid external network dependencies.

## 🗺️ Roadmap

- [ ] Add persistent task storage.
- [ ] Improve filename categorisation by file type.
- [ ] Add task priorities and deadlines.
- [ ] Support configurable AI models.
- [ ] Improve offline-first behaviour.
- [ ] Add optional local document parsing.
- [ ] Add automated tests for the AI workflows.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request describing your improvements.

## 📄 License

Choose an open-source license before publishing. For example, the MIT License allows broad reuse and modification when its conditions are followed. Add a `LICENSE` file if you choose MIT.

---

**Built with HTML, CSS, JavaScript, and Ollama.**

*LazyDesk AI — Make progress, one task at a time.*
