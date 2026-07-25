FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Vite grava VITE_* no bundle em TEMPO DE BUILD, não de execução. Defaults já
# apontam pra URL de produção real; passe --build-arg no EasyPanel só se
# precisar apontar pra outro ambiente.
ARG VITE_API_BASE_URL=https://desk-api.fluxytechnologies.com.br
ARG VITE_WS_BASE_URL=wss://desk-api.fluxytechnologies.com.br
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 7080
CMD ["serve", "-s", "dist", "-l", "7080"]
