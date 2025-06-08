from flask import Flask, render_template, request, jsonify
import re
import requests

app = Flask(__name__)

# Suspicious indicators
SUSPICIOUS_KEYWORDS = [
    "verify your account", "click here", "login immediately", "urgent action",
    "update your password", "account suspended", "unauthorized login", "security alert",
    "confirm your identity", "reset your password", "payment failed", "win a prize"
]

FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
SUSPICIOUS_TLDS = ['.xyz', '.top', '.online', '.club']
BRAND_NAMES = ['sbi', 'paypal', 'google', 'microsoft', 'amazon', 'apple', 'hdfc', 'icici', 'netflix', 'linkedin']
GENERIC_SUSPICIOUS_KEYWORDS = ['bank', 'support', 'service', 'helpdesk', 'admin', 'update', 'secure', 'team']

def load_blacklist():
    try:
        with open('blacklist.txt', 'r') as f:
            return set(line.strip().lower() for line in f if line.strip())
    except FileNotFoundError:
        return set()

blacklisted_domains = load_blacklist()

def domain_is_suspicious(sender_email, breakdown):
    domain = sender_email.split('@')[-1].lower()
    name = sender_email.split('@')[0].lower()

    if domain in blacklisted_domains:
        breakdown.append("❌ Blacklisted domain detected")
        return True

    for brand in BRAND_NAMES:
        if brand in name and domain in FREE_EMAIL_DOMAINS:
            breakdown.append("⚠️ Brand name with free email domain")
            return True

    if domain in FREE_EMAIL_DOMAINS:
        for keyword in GENERIC_SUSPICIOUS_KEYWORDS:
            if keyword in name:
                breakdown.append("⚠️ Generic suspicious keyword with free domain")
                return True

    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            breakdown.append("⚠️ Suspicious domain extension")
            return True

    return False

def is_phishing(email_text, sender_email):
    score = 0
    breakdown = []

    for keyword in SUSPICIOUS_KEYWORDS:
        if keyword in email_text.lower():
            score += 1
            breakdown.append(f'Suspicious keyword found: "{keyword}"')

    if re.search(r'https?://[^\s]+', email_text.lower()):
        score += 1
        breakdown.append("URL detected, might be suspicious")

    if domain_is_suspicious(sender_email, breakdown):
        score += 1

    if score >= 3:
        return {"phishing": True, "message": "⚠️ This looks like a phishing email.", "breakdown": breakdown}
    elif score == 2:
        return {"phishing": None, "message": "⚠️ This email looks suspicious. Be cautious.", "breakdown": breakdown}
    else:
        return {"phishing": False, "message": "✅ This email seems safe.", "breakdown": breakdown}

def grammar_check(text):
    url = "https://api.languagetool.org/v2/check"
    data = {
        "text": text,
        "language": "en-US"
    }
    response = requests.post(url, data=data)
    response.raise_for_status()

    results = []
    matches = response.json().get("matches", [])
    for match in matches:
        results.append({
            "message": match.get("message"),
            "suggestions": [r["value"] for r in match.get("replacements", [])][:3],
            "offset": match.get("offset"),
            "length": match.get("length"),
            "context": text[match.get("offset"):match.get("offset") + match.get("length")]
        })
    return results

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check', methods=['POST'])
def check_email():
    data = request.get_json()
    email_content = data.get('email_content', '')
    sender_email = data.get('sender_email', '')

    result = is_phishing(email_content, sender_email)

    try:
        result["grammar_issues"] = grammar_check(email_content)
    except Exception as e:
        result["grammar_issues"] = []
        result["grammar_error"] = str(e)

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
