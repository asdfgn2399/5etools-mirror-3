#!/bin/bash

mkdir env
echo "export const environment = { apiKey: '$1' }"  > env/env.js