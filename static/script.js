document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("email-form");
  const senderEmailInput = document.getElementById("sender-email");
  const emailContentInput = document.getElementById("email-content");
  const resultDiv = document.getElementById("result");
  const highlightedContentDiv = document.getElementById("highlighted-content");
  const buttonContainer = document.getElementById("button-container");
  const breakdownDiv = document.getElementById("breakdown-div");
  const toggle = document.getElementById("theme-toggle");

  const keywords = [
    "verify your account", "click here", "login immediately", "urgent action",
    "update your password", "account suspended", "unauthorized login", "security alert",
    "confirm your identity", "reset your password", "payment failed", "win a prize"
  ];

  // Create Clear and Copy buttons once
  const buttonGroup = document.createElement("div");
  buttonGroup.classList.add("button-group");

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "Clear";
  clearButton.classList.add("btn-clear");

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy Highlighted";
  copyButton.classList.add("btn-copy");

  buttonGroup.appendChild(clearButton);
  buttonGroup.appendChild(copyButton);
  buttonContainer.appendChild(buttonGroup);

  // Spinner element
  const spinner = document.createElement("div");
  spinner.classList.add("spinner");
  spinner.style.display = "none";
  buttonContainer.appendChild(spinner);

  // Email format validation
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Escape HTML entities
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;");
  }

  // Highlight suspicious keywords and URLs inside text (non-overlapping, outside HTML tags)
  function highlightSuspicious(text) {
    let highlighted = text;

    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, "gi");
      highlighted = highlighted.replace(regex, '<span class="highlight-danger">$1</span>');
    });

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    highlighted = highlighted.replace(urlRegex, '<span class="highlight-danger">$1</span>');

    return highlighted;
  }

  // Highlight grammar issues by wrapping the error substring with a span
  // Combine with suspicious keywords highlight
  function highlightContent(text, grammarIssues) {
    // Escape HTML first
    let escapedText = escapeHtml(text);

    // We'll store markers for opening and closing spans
    const opens = {};
    const closes = {};

    // Mark grammar issues positions
    grammarIssues.forEach(issue => {
      // Because the text is escaped, offset still works since no chars added before offset
      if (!opens[issue.offset]) opens[issue.offset] = [];
      opens[issue.offset].push('<span class="highlight-grammar">');

      const closePos = issue.offset + issue.length;
      if (!closes[closePos]) closes[closePos] = [];
      closes[closePos].push('</span>');
    });

    // Build highlighted string with grammar spans inserted
    let result = "";
    for (let i = 0; i < escapedText.length; i++) {
      if (opens[i]) {
        result += opens[i].join('');
      }
      result += escapedText[i];
      if (closes[i + 1]) {
        result += closes[i + 1].join('');
      }
    }

    // Now highlight suspicious keywords and URLs in the resulting string but avoid HTML tags
    // Helper to highlight only outside HTML tags
    function highlightOutsideTags(str, regex, className) {
      return str.split(/(<[^>]+>)/g).map(part => {
        if (part.startsWith("<")) return part; // skip tags
        return part.replace(regex, `<span class="${className}">$1</span>`);
      }).join("");
    }

    // Highlight suspicious keywords
    const keywordsPattern = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|");
    result = highlightOutsideTags(result, new RegExp(`(${keywordsPattern})`, "gi"), "highlight-danger");

    // Highlight URLs
    result = highlightOutsideTags(result, /(https?:\/\/[^\s]+)/gi, "highlight-danger");

    return result;
  }

  // Form submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const senderEmail = senderEmailInput.value.trim();
    const emailContent = emailContentInput.value.trim();

    resultDiv.textContent = "";
    highlightedContentDiv.innerHTML = "";
    breakdownDiv.innerHTML = "";
    document.getElementById("grammar-issues").innerHTML = "";

    if (!isValidEmail(senderEmail)) {
      resultDiv.style.color = "red";
      resultDiv.textContent = "Please enter a valid sender email.";
      return;
    }

    if (!emailContent) {
      resultDiv.style.color = "red";
      resultDiv.textContent = "Email content cannot be empty.";
      return;
    }

    spinner.style.display = "inline-block";
    clearButton.disabled = true;
    copyButton.disabled = true;

    try {
      const response = await fetch("/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_content: emailContent, sender_email: senderEmail }),
      });

      const data = await response.json();

      resultDiv.style.color = data.phishing === true ? "red" :
                              data.phishing === false ? "green" : "blue";
      resultDiv.textContent = data.message;

      // Highlight content with grammar and suspicious highlights
      highlightedContentDiv.innerHTML = highlightContent(emailContent, data.grammar_issues || []);

      if (data.breakdown && data.breakdown.length) {
        breakdownDiv.innerHTML = "<strong>Analysis details:</strong><ul>" +
          data.breakdown.map(item => `<li>${item}</li>`).join('') +
          "</ul>";
      }

      if (data.grammar_issues && data.grammar_issues.length) {
        const grammarDiv = document.getElementById("grammar-issues");
        grammarDiv.innerHTML = "<strong>Grammar/Spelling Suggestions:</strong><ul>" +
          data.grammar_issues.map(issue =>
            `<li>${issue.message}` +
            (issue.suggestions.length ? ` (Suggestions: ${issue.suggestions.join(', ')})` : '') +
            `</li>`
          ).join('') +
          "</ul>";
      }
    } catch (err) {
      resultDiv.style.color = "red";
      resultDiv.textContent = "Error analyzing the email. Please try again.";
      console.error(err);
    } finally {
      spinner.style.display = "none";
      clearButton.disabled = false;
      copyButton.disabled = false;
    }
  });

  // Clear button
  clearButton.addEventListener("click", () => {
    senderEmailInput.value = "";
    emailContentInput.value = "";
    resultDiv.textContent = "";
    highlightedContentDiv.innerHTML = "";
    breakdownDiv.innerHTML = "";
    document.getElementById("grammar-issues").innerHTML = "";
  });

  // Copy button
  copyButton.addEventListener("click", () => {
    const tempElem = document.createElement("textarea");
    tempElem.value = highlightedContentDiv.textContent || "";
    document.body.appendChild(tempElem);
    tempElem.select();
    document.execCommand("copy");
    document.body.removeChild(tempElem);

    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy Highlighted";
    }, 1500);
  });

  // Theme toggle logic
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggle.checked = true;
  }

  toggle.addEventListener("change", () => {
    document.body.classList.toggle("dark");
    if (document.body.classList.contains("dark")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }
  });
});
