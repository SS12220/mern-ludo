import React, { useState, useEffect, useRef } from 'react';
import useAudioCall from '../../hooks/useAudioCall';
import micOnIcon from '../../Icons/mic-on.svg';
import micOffIcon from '../../Icons/mic-off.svg';

const AudioStream = ({ stream }) => {
    const audioRef = useRef();

    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay />;
};

const AudioCallManager = ({ socket }) => {
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    
    // The hook only initializes Peer and getUserMedia when isAudioEnabled is true.
    const { remoteStreams, toggleMute } = useAudioCall(socket, isAudioEnabled);

    const handleToggleAudio = () => {
        if (!isAudioEnabled) {
            // First time clicking: request permissions and enable audio call
            setIsAudioEnabled(true);
            setIsMuted(false);
        } else {
            // Already enabled: just toggle mute
            const newMutedState = !isMuted;
            setIsMuted(newMutedState);
            toggleMute(newMutedState);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
                onClick={handleToggleAudio}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                style={{
                    padding: '8px', 
                    cursor: 'pointer', 
                    background: 'rgba(0, 0, 0, 0.5)', 
                    border: '1px solid #555', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backdropFilter: 'blur(5px)'
                }}
            >
                <img 
                    src={isMuted ? micOffIcon : micOnIcon} 
                    alt={isMuted ? "Mic Off" : "Mic On"} 
                    style={{ width: '20px', height: '20px', filter: 'invert(1)' }} 
                />
            </button>
            
            {/* Render all incoming remote audio streams */}
            <div style={{ display: 'none' }}>
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <AudioStream key={peerId} stream={stream} />
                ))}
            </div>
        </div>
    );
};

export default AudioCallManager;
