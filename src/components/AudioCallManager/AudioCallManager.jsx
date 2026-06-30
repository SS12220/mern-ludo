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

const AudioCallContent = ({ roomId, appId, token }) => {
    const [isMuted, setIsMuted] = useState(false);
    
    // Join the channel automatically using the roomId and secure token
    useJoin({
        appid: appId,
        channel: roomId,
        token: token,
    }, !!(appId && token && roomId));

    // Get the local microphone track
    const { localMicrophoneTrack, isLoading, error } = useLocalMicrophoneTrack();
    
    if (error) {
        console.error("Agora Mic Error:", error);
    }
    
    // Publish the track to the channel
    usePublish([localMicrophoneTrack]);

    const remoteUsers = useRemoteUsers();
    const { audioTracks } = useRemoteAudioTracks(remoteUsers);

    const handleToggleAudio = () => {
        setIsMuted(prev => !prev);
    };

    // Ensure it starts muted based on initial state
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
    const [agoraAuth, setAgoraAuth] = useState(null);
    const [isFetching, setIsFetching] = useState(false);
    
    // Create the Agora Client
    const client = useRTCClient(AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' }));

    const enableVoiceChat = async () => {
        setIsFetching(true);
        try {
            // Fetch secure token and App ID from our Node.js backend
            const response = await fetch(`/api/agora/token?channelName=${roomId}`);
            const data = await response.json();
            
            if (data.token && data.appId) {
                setAgoraAuth(data);
                setIsAudioEnabled(true);
            } else {
                console.error("Failed to fetch Agora token from server:", data);
            }
        } catch (error) {
            console.error("Error connecting to token server:", error);
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <>
            {!isAudioEnabled ? (
                <button 
                    onClick={enableVoiceChat}
                    disabled={isFetching}
                    title="Enable Voice Chat"
                    style={{
                        padding: '8px', 
                        cursor: 'pointer', 
                        background: isFetching ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)', 
                        border: '1px solid #555', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        backdropFilter: 'blur(5px)',
                        opacity: isFetching ? 0.5 : 1
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
                    <AudioCallContent roomId={roomId} appId={agoraAuth.appId} token={agoraAuth.token} />
                </AgoraRTCProvider>
            )}
        </>
    );
};

export default AudioCallManager;
