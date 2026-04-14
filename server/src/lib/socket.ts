import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

export let io: Server;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Yeni bir istemci bağlandı:', socket.id);

    // İstemci canlı dinleme odasına katılmak isteyebilir
    socket.on('joinDashboard', () => {
      socket.join('dashboard');
      console.log(`İstemci ${socket.id} dashboard odasına katıldı.`);
    });

    socket.on('disconnect', () => {
      console.log('İstemci bağlantısı koptu:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io henüz initialize edilmedi!');
  }
  return io;
};
