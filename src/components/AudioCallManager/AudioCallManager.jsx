import React, { useState } from 'react';
import AgoraRTC, { 
    AgoraRTCProvider, 
    useRTCClient, 
    useJoin, 
    useLocalMicrophoneTrack, 
    usePublish, 
    useRemoteUsers,
    useRemoteAudioTracks,
    RemoteAudioTrack 
} from 'agora-rtc-react';
import micOnIcon from '../../Icons/mic-on.svg';
import micOffIcon from '../../Icons/mic-off.svg';

const appId = process.env.REACT_APP_AGORA_APP_ID || 'YOUR_APP_ID_HERE';

const AudioCallContent = ({ roomId }) => {
    const [isMuted, setIsMuted] = useState(false);
    
    // Join the channel automatically using the roomId
    useJoin({
        appid: appId,
        channel: roomId,
        token: null,
    }, true);

    // Get the local microphone track
    const { localMicrophoneTrack } = useLocalMicrophoneTrack();
    
    // Publish the track to the channel
    usePublish([localMicrophoneTrack]);

    const remoteUsers = useRemoteUsers();
    const { audioTracks } = useRemoteAudioTracks(remoteUsers);

    const handleToggleAudio = () => {
        setIsMuted(prev => !prev);
    };

    // Ensure it starts muted based on initial state, but since we require a click to enable, 
    // it's better if it starts unmuted when they finally click it. 
    React.useEffect(() => {
        if (localMicrophoneTrack) {
            localMicrophoneTrack.setMuted(isMuted);
        }
    }, [localMicrophoneTrack, isMuted]);

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
            
            {/* Render remote audio tracks */}
            <div style={{ display: 'none' }}>
                {audioTracks.map(track => (
                    <RemoteAudioTrack key={track.getUserId()} track={track} play={true} />
                ))}
            </div>
        </div>
    );
};

const AudioCallManager = ({ roomId }) => {
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    
    // Create the Agora Client
    const client = useRTCClient(AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' }));

    return (
        <>
            {!isAudioEnabled ? (
                <button 
                    onClick={() => setIsAudioEnabled(true)}
                    title="Enable Voice Chat"
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
                        src={micOffIcon} 
                        alt="Enable Voice Chat" 
                        style={{ width: '20px', height: '20px', filter: 'invert(1)' }} 
                    />
                </button>
            ) : (
                <AgoraRTCProvider client={client}>
                    <AudioCallContent roomId={roomId} />
                </AgoraRTCProvider>
            )}
        </>
    );
};

export default AudioCallManager;
