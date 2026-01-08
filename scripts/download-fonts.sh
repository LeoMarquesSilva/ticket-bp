#!/bin/bash
# Script para baixar as fontes Montserrat

# Criar pasta de fontes se não existir
mkdir -p public/fonts

# URLs para download das fontes
REGULAR="https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2"
MEDIUM="https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Hw5aXp-p7K4KLg.woff2"
SEMIBOLD="https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu173w5aXp-p7K4KLg.woff2"
BOLD="https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXp-p7K4KLg.woff2"

# Baixar as fontes
echo "Baixando Montserrat Regular..."
curl -L $REGULAR -o public/fonts/Montserrat-Regular.woff2

echo "Baixando Montserrat Medium..."
curl -L $MEDIUM -o public/fonts/Montserrat-Medium.woff2

echo "Baixando Montserrat SemiBold..."
curl -L $SEMIBOLD -o public/fonts/Montserrat-SemiBold.woff2

echo "Baixando Montserrat Bold..."
curl -L $BOLD -o public/fonts/Montserrat-Bold.woff2

echo "Fontes baixadas com sucesso!"