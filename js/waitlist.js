const API_URL =
    window.location.port === "8000"
        ? ""
        : "http://127.0.0.1:8000";

const form = document.getElementById("waitlistForm");
const errorNode = document.getElementById("formError");
const submitButton = document.getElementById("submitButton");
const signupCard = document.getElementById("signupCard");
const thanksCard = document.getElementById("thanksCard");
const proof = document.getElementById("socialProof");

function showError(message) {
    errorNode.hidden = false;
    errorNode.textContent = message;
}

function hideError() {
    errorNode.hidden = true;
    errorNode.textContent = "";
}

function thankYou(username, email, emailSent) {
    const title = document.getElementById("thanksTitle");
    const body = document.getElementById("thanksBody");

    title.textContent = `You're locked in, ${username}.`;
    body.textContent = emailSent
        ? `We sent the receipt to ${email}. When RATED drops, that inbox gets the keys. Keep your password — that's your seat.`
        : `You're on the list as ${username}. When RATED drops, we'll hit ${email}. Keep your password — that's your seat.`;

    signupCard.hidden = true;
    thanksCard.hidden = false;
}

async function loadCount() {
    try {
        const response = await fetch(`${API_URL}/waitlist/count`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data.count > 0) {
            proof.hidden = false;
            proof.textContent =
                data.count === 1
                    ? "1 name already on the wall."
                    : `${data.count} names already on the wall.`;
        }
    } catch (error) {
        return;
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    hideError();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (username.length < 3) {
        showError("Username must be at least 3 characters.");
        return;
    }

    if (!email.includes("@")) {
        showError("Enter a real email.");
        return;
    }

    if (password.length < 8) {
        showError("Password must be at least 8 characters.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Locking it in…";

    try {
        const response = await fetch(`${API_URL}/waitlist`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const detail = data.detail;
            const message =
                typeof detail === "string"
                    ? detail
                    : Array.isArray(detail) && detail[0] && detail[0].msg
                    ? detail[0].msg
                    : "Could not join the list. Is the RATED server running?";
            showError(message);
            submitButton.disabled = false;
            submitButton.textContent = "Get on the list";
            return;
        }

        thankYou(data.username, data.email, data.emailSent);
    } catch (error) {
        showError("Could not reach the waitlist. Start the RATED server and try again.");
        submitButton.disabled = false;
        submitButton.textContent = "Get on the list";
    }
});

loadCount();
