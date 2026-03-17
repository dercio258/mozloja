const { Server } = require('socket.io');

let io;

const socketService = {
    init(server) {
        io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            socket.on('join', (saleId) => {
                socket.join(saleId);
                console.log(`Socket ${socket.id} joined room ${saleId}`);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        return io;
    },

    notifyPaymentSuccess(saleId, redirectUrl) {
        if (io) {
            io.to(saleId).emit('payment_success', {
                redirect: redirectUrl
            });
            console.log(`[Socket] Payment success notified for sale ${saleId}`);
        }
    }
};

module.exports = socketService;
