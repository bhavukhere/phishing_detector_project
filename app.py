from flask import Flask, render_template, request, jsonify
import re

app = Flask(__name__)

# Suspicious keywords to detect in email body
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

    # Check blacklist exact match
    if domain in blacklisted_domains:
        breakdown.append("❌ Blacklisted domain detected")
        return True

    # Brand + free domain heuristic
    for brand in BRAND_NAMES:
        if brand in name and domain in FREE_EMAIL_DOMAINS:
            breakdown.append("⚠️ Brand name with free email domain")
            return True

    # Generic suspicious keywords with free domain
    if domain in FREE_EMAIL_DOMAINS:
        for keyword in GENERIC_SUSPICIOUS_KEYWORDS:
            if keyword in name:
                breakdown.append("⚠️ Generic suspicious keyword with free domain")
                return True

    # Suspicious TLDs check
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            breakdown.append("⚠️ Suspicious domain extension")
            return True

    return False

def is_phishing(email_text, sender_email):
    score = 0
    breakdown = []

    # Check suspicious keywords in email text
    for keyword in SUSPICIOUS_KEYWORDS:
        if keyword in email_text.lower():
            score += 1
            breakdown.append(f"Suspicious keyword found: \"{keyword}\"")

    # Check for suspicious URLs
    if re.search(r'https?://[^\s]+', email_text.lower()):
        score += 1
        breakdown.append("Suspicious URL detected")

    # Check domain heuristics
    if domain_is_suspicious(sender_email, breakdown):
        score += 1

    # Final classification
    if score >= 3:
        return {"phishing": True, "message": "⚠️ This looks like a phishing email.", "breakdown": breakdown}
    elif score == 2:
        return {"phishing": None, "message": "⚠️ This email looks suspicious. Be cautious.", "breakdown": breakdown}
    else:
        return {"phishing": False, "message": "✅ This email seems safe.", "breakdown": breakdown}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check', methods=['POST'])
def check_email():
    data = request.get_json()
    email_content = data.get('email_content', '')
    sender_email = data.get('sender_email', '')
    result = is_phishing(email_content, sender_email)
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
