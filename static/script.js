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

  // Highlight suspicious keywords and URLs
  function highlightContent(text) {
    let highlighted = text;

    // Escape HTML entities
    highlighted = highlighted.replace(/&/g, "&amp;")
                             .replace(/</g, "&lt;")
                             .replace(/>/g, "&gt;");

    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, "gi");
      highlighted = highlighted.replace(regex, '<span class="highlight-danger">$1</span>');
    });

    // Highlight URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    highlighted = highlighted.replace(urlRegex, '<span class="highlight-danger">$1</span>');

    return highlighted;
  }

  // Form submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const senderEmail = senderEmailInput.value.trim();
    const emailContent = emailContentInput.value.trim();

    resultDiv.textContent = "";
    highlightedContentDiv.innerHTML = "";
    breakdownDiv.innerHTML = "";

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

      if (data.phishing === true) {
        resultDiv.style.color = "red";
      } else if (data.phishing === false) {
        resultDiv.style.color = "green";
      } else {
        resultDiv.style.color = "blue";
      }
      resultDiv.textContent = data.message;

      const highlighted = highlightContent(emailContent);
      highlightedContentDiv.innerHTML = highlighted;

      if (data.breakdown && data.breakdown.length) {
        breakdownDiv.innerHTML = "<strong>Analysis details:</strong><ul>" +
          data.breakdown.map(item => `<li>${item}</li>`).join('') +
          "</ul>";
      } else {
        breakdownDiv.innerHTML = "";
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
