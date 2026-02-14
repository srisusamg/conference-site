document.addEventListener("DOMContentLoaded", function() {
    // Load schedule data
    fetch('js/data/schedule.js')
        .then(response => response.json())
        .then(data => {
            const scheduleDiv = document.getElementById('schedule');
            data.sessions.forEach(session => {
                const sessionElement = document.createElement('div');
                sessionElement.innerHTML = `<h2>${session.title}</h2><p>${session.description}</p>`;
                scheduleDiv.appendChild(sessionElement);
            });
        });

    // Load speakers data
    fetch('js/data/speakers.js')
        .then(response => response.json())
        .then(data => {
            const speakersDiv = document.getElementById('speakers');
            data.speakers.forEach(speaker => {
                const speakerElement = document.createElement('div');
                speakerElement.innerHTML = `<h2>${speaker.name}</h2><p>${speaker.bio}</p>`;
                speakersDiv.appendChild(speakerElement);
            });
        });
});