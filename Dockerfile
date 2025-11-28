# Dockerfile for Nitter on Render.com

FROM zedeus/nitter:latest

# Copy config
COPY nitter.conf /src/nitter.conf

# Expose port
EXPOSE 8080

# Start Nitter
CMD ["./nitter"]
