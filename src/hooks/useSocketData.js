import { useState, useContext, useEffect } from 'react';
import { SocketContext } from '../App';

const useSocketData = port => {
    const socket = useContext(SocketContext);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!socket) return;
        const handler = res => {
            let parsedData;
            try {
                parsedData = JSON.parse(res);
            } catch (error) {
                parsedData = res;
            }
            setData(parsedData);
        };
        socket.on(port, handler);
        return () => {
            socket.off(port, handler);
        };
    }, [socket, port]);

    return [data, setData];
};

export default useSocketData;
