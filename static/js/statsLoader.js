// public/stats_loader.js (or similar path)
document.addEventListener('DOMContentLoaded', () => {
    fetchTotalMoviesWatched();
    fetchTotalMoviesRated();
    fetchTotalHoursWatched();
    fetchRewatchStats();
});

async function fetchData(url, elementId, formatter) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        document.getElementById(elementId).textContent = formatter(data);
    } catch (error) {
        console.error(`Failed to fetch data for ${elementId} from ${url}:`, error);
        document.getElementById(elementId).textContent = 'Error';
    }
}

function fetchTotalMoviesWatched() {
    fetchData('/api/stats/total-watched', 'totalMoviesWatched', data => data.count.toLocaleString());
}

function fetchTotalMoviesRated() {
    fetchData('/api/stats/total-rated', 'totalMoviesRated', data => data.count.toLocaleString());
}

function fetchTotalHoursWatched() {
    fetchData('/api/stats/total-hours', 'totalHoursWatched', data => 
        data.total_hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    );
}

function fetchRewatchStats() {
    fetchData('/api/stats/rewatches', 'rewatchStats', data => 
        `${data.rewatches.toLocaleString()} / ${data.new_watches.toLocaleString()}`
    );
}