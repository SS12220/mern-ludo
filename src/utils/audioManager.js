import clickSound from '../Audios/click.mp3';
import congratulationsSound from '../Audios/congratulations.mp3';
import deathSound from '../Audios/death.mp3';
import dicerollSound from '../Audios/diceroll.mp3';
import gamestartSound from '../Audios/gamestartsound.mp3';
import pantaSound from '../Audios/panta.mp3';
import safeSound from '../Audios/safe.mp3';
import stepSound from '../Audios/step.mp3';

class AudioManager {
    constructor() {
        this.sounds = {
            click: new Audio(clickSound),
            congratulations: new Audio(congratulationsSound),
            death: new Audio(deathSound),
            diceroll: new Audio(dicerollSound),
            gamestart: new Audio(gamestartSound),
            panta: new Audio(pantaSound),
            safe: new Audio(safeSound),
            step: new Audio(stepSound)
        };

        // Enable preloading
        Object.values(this.sounds).forEach(audio => {
            audio.preload = 'auto';
        });
    }

    play(soundName) {
        if (document.hidden) return; // Prevent backlog audio playing when tab is hidden
        if (this.sounds[soundName]) {
            // Clone the node so we can play overlapping sounds (like fast steps)
            const soundClone = this.sounds[soundName].cloneNode();
            soundClone.volume = 0.7; // Slightly reduce volume
            soundClone.play().catch(e => {
                if (e.name !== 'NotAllowedError') {
                    console.warn('Audio playback failed:', e);
                }
            });
        }
    }
}

const audioManager = new AudioManager();
export default audioManager;
