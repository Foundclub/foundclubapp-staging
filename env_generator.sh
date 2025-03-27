#!/bin/bash

# Set the path to your .env.dist file
ENV_FILE=".env.dist"
# Set the path to your output JSON file
OUTPUT_FILE=".env"

# Check if .env.dist exists
if [[ ! -f $ENV_FILE ]]; then
    echo "$ENV_FILE file not found!"
    exit 1
fi

# Create or empty the .env file
> $OUTPUT_FILE

# Define the prefix
PREFIX=$ENV

# Read each line from .env.dist
while IFS= read -r line; do
    # Check if line is not empty and does not begin with a comment (#)
    if [[ -n "$line" && ! "$line" =~ ^# ]]; then
        # Get the variable name
        var_name=$(echo "$line" | cut -d '=' -f 1)

        # Construct the environment variable name with the prefix
        env_var_name="${PREFIX}_${var_name}"

        # Check if the prefixed environment variable exists
        if [[ -n ${!env_var_name} ]]; then
            # Write the variable with the prefix removed and its value to .env
            echo "$var_name=${!env_var_name}" >> $OUTPUT_FILE
        else
            echo "Warning: $env_var_name is not set in the environment."
        fi
    fi
done < $ENV_FILE