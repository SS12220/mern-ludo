import { useEffect, useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';

const useAudioCall = (socket, isAudioEnabled) => {
    const [peerId, setPeerId] = useState('');
    const [remoteStreams, setRemoteStreams] = useState({});
    const peerInstance = useRef(null);
    const localStream = useRef(null);

    // Initialize peer and media stream when audio is enabled
    useEffect(() => {
        if (!isAudioEnabled || !socket) return;

        let myPeer = new Peer();
        
        myPeer.on('open', (id) => {
            setPeerId(id);
            peerInstance.current = myPeer;
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error("MediaDevices or getUserMedia is not supported in this browser context (insecure origin).");
                alert("Microphone access is blocked by your browser on insecure HTTP network connections. Please use 'localhost:3000' or configure HTTPS.");
                return;
            }

            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then((stream) => {
                    localStream.current = stream;
                    // Emit our peer ID to others in the room
                    socket.emit('audio:join', id);
                })
                .catch((err) => {
                    console.error("Failed to get local stream", err);
                    alert("Microphone permission denied or no microphone found.");
                });
        });

        myPeer.on('call', (call) => {
            // Answer the call with our stream
            if (localStream.current) {
                call.answer(localStream.current);
                call.on('stream', (userVideoStream) => {
                    setRemoteStreams(prev => ({ ...prev, [call.peer]: userVideoStream }));
                });
            }
        });

        // Cleanup
        return () => {
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }
            if (peerInstance.current) {
                peerInstance.current.destroy();
            }
            setRemoteStreams({});
        };
    }, [isAudioEnabled, socket]);

    // Listen for new users joining to call them
    useEffect(() => {
        if (!socket || !peerInstance.current || !isAudioEnabled) return;

        const handleUserJoined = (newPeerId) => {
            if (!localStream.current) return;
            const call = peerInstance.current.call(newPeerId, localStream.current);
            if (call) {
                call.on('stream', (userVideoStream) => {
                    setRemoteStreams(prev => ({ ...prev, [newPeerId]: userVideoStream }));
                });
            }
        };

        socket.on('audio:user-joined', handleUserJoined);

        return () => {
            socket.off('audio:user-joined', handleUserJoined);
        };
    }, [socket, isAudioEnabled, peerId]); // depend on peerId to ensure local peer is initialized

    const toggleMute = useCallback((muted) => {
        if (localStream.current) {
            localStream.current.getAudioTracks()[0].enabled = !muted;
        }
    }, []);

    return { remoteStreams, toggleMute };
};

export default useAudioCall;
