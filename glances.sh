#!/bin/bash

# Check if the container is already running
existing_container=$(docker ps --filter "ancestor=nicolargo/glances:latest-full" -q)

# If a container is found, stop and remove it
if [ -n "$existing_container" ]; then
  echo "Stopping and removing existing container..."
  docker stop "$existing_container"
  docker rm "$existing_container"
fi

# Run the new container
docker run --rm -e TZ="${TZ}" \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /run/user/1000/podman/podman.sock:/run/user/1000/podman/podman.sock:ro \
  --pid host --network host -it nicolargo/glances:latest-full