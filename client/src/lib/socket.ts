import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:3005/api`);
const socketioHost = API_URL.startsWith('http') ? API_URL.replace(/\/api$/, '') : window.location.origin;

export const socket: Socket = io(socketioHost);

socket.on('connect', () => {
    console.log('Socket.io connected:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
});
