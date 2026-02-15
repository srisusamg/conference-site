document.addEventListener("DOMContentLoaded", function() {
    const prefix = window.location.pathname.includes("/pages/") ? "../" : "";

    // Load schedule data
    fetch(`${prefix}js/data/schedule.js`)
        .then(response => response.json())
        .then(data => {
            const scheduleDiv = document.getElementById('schedule');
            if (!scheduleDiv) {
                return;
            }

            const sessions = Array.isArray(data.sessions) ? data.sessions : [];
            if (!sessions.length) {
                scheduleDiv.textContent = 'No schedule published yet.';
                return;
            }

            sessions.forEach(session => {
                const sessionElement = document.createElement('div');
                sessionElement.innerHTML = `<h2>${session.title}</h2><p>${session.description}</p>`;
                scheduleDiv.appendChild(sessionElement);
            });
        })
        .catch(() => {
            const scheduleDiv = document.getElementById('schedule');
            if (scheduleDiv) {
                scheduleDiv.textContent = 'Unable to load schedule right now.';
            }
        });

    // Load speakers data
    fetch(`${prefix}js/data/speakers.js`)
        .then(response => response.json())
        .then(data => {
            const speakersDiv = document.getElementById('speakers');
            if (!speakersDiv) {
                return;
            }

            const speakers = Array.isArray(data.speakers) ? data.speakers : [];
            if (!speakers.length) {
                speakersDiv.textContent = 'No speakers published yet.';
                return;
            }

            speakers.forEach(speaker => {
                const speakerElement = document.createElement('div');
                speakerElement.innerHTML = `<h2>${speaker.name}</h2><p>${speaker.bio}</p>`;
                speakersDiv.appendChild(speakerElement);
            });
        })
        .catch(() => {
            const speakersDiv = document.getElementById('speakers');
            if (speakersDiv) {
                speakersDiv.textContent = 'Unable to load speakers right now.';
            }
        });
});