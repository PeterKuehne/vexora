#!/bin/bash
# Deploy Reranker Service to Ubuntu Server
# Target: 192.168.178.23

UBUNTU_HOST="192.168.178.23"
UBUNTU_USER="peter"  # Adjust if different
REMOTE_DIR="/opt/vexora/reranker"

echo "📦 Deploying Reranker Service to $UBUNTU_HOST..."

# Create remote directory and copy files
ssh $UBUNTU_USER@$UBUNTU_HOST "sudo mkdir -p $REMOTE_DIR && sudo chown $UBUNTU_USER:$UBUNTU_USER $REMOTE_DIR"

# Copy Python files
scp reranker_service.py requirements.txt $UBUNTU_USER@$UBUNTU_HOST:$REMOTE_DIR/

# Copy systemd service file
scp reranker.service $UBUNTU_USER@$UBUNTU_HOST:/tmp/
ssh $UBUNTU_USER@$UBUNTU_HOST "sudo mv /tmp/reranker.service /etc/systemd/system/"

# Setup on remote
ssh $UBUNTU_USER@$UBUNTU_HOST << 'REMOTE_SCRIPT'
cd /opt/vexora/reranker

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Install dependencies
source venv/bin/activate
pip install -q -r requirements.txt

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable reranker
sudo systemctl restart reranker

echo "✅ Reranker service deployed and started!"
systemctl status reranker --no-pager
REMOTE_SCRIPT

echo ""
echo "🎉 Done! Reranker running at http://$UBUNTU_HOST:8001"
echo "   Health check: curl http://$UBUNTU_HOST:8001/health"
