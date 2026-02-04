#!/bin/bash
# Deploy Parser Service to Ubuntu Server
# Target: 192.168.178.23:8002

UBUNTU_HOST="192.168.178.23"
UBUNTU_USER="peter"  # Adjust if different
REMOTE_DIR="/opt/vexora/parser"

echo "📦 Deploying Parser Service to $UBUNTU_HOST..."

# Create remote directory and copy files
ssh $UBUNTU_USER@$UBUNTU_HOST "sudo mkdir -p $REMOTE_DIR && sudo chown $UBUNTU_USER:$UBUNTU_USER $REMOTE_DIR"

# Copy Python files
scp parser_service.py requirements.txt $UBUNTU_USER@$UBUNTU_HOST:$REMOTE_DIR/

# Copy systemd service file
scp parser.service $UBUNTU_USER@$UBUNTU_HOST:/tmp/
ssh $UBUNTU_USER@$UBUNTU_HOST "sudo mv /tmp/parser.service /etc/systemd/system/"

# Setup on remote
ssh $UBUNTU_USER@$UBUNTU_HOST << 'REMOTE_SCRIPT'
cd /opt/vexora/parser

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
source venv/bin/activate
echo "Installing dependencies (this may take a while for docling)..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable parser
sudo systemctl restart parser

echo "✅ Parser service deployed and started!"
systemctl status parser --no-pager
REMOTE_SCRIPT

echo ""
echo "🎉 Done! Parser running at http://$UBUNTU_HOST:8002"
echo "   Health check: curl http://$UBUNTU_HOST:8002/health"
echo "   Formats: curl http://$UBUNTU_HOST:8002/formats"
