const path = require('path');    
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
require('dotenv').config();

// --- CONFIGURAÇÕES ---
// Removemos @c.us caso você tenha colocado no .env, para evitar duplicação
const DONO_DO_BOT = (process.env.NUMERO_DONO || '258840000000').replace('@c.us', ''); 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const historiaChat = {}; // Isto vai guardar as conversas

// --- SISTEMA DE PERMITIDOS (COM PROTEÇÃO ANTI-ERRO) ---
const ARQUIVO_PERMITIDOS = 'permitidos.json';
let permitidos = [];

function carregarPermitidos() {
    try {
        if (fs.existsSync(ARQUIVO_PERMITIDOS)) {
            const dados = JSON.parse(fs.readFileSync(ARQUIVO_PERMITIDOS));
            // AQUI ESTÁ A CORREÇÃO: Verifica se é uma lista real
            if (Array.isArray(dados)) {
                permitidos = dados;
            } else {
                console.log('⚠️ Arquivo permitidos estava errado. Resetando...');
                permitidos = [DONO_DO_BOT];
                salvarPermitidos();
            }
        } else {
            permitidos = [DONO_DO_BOT];
            salvarPermitidos();
        }
    } catch (e) {
        console.log('⚠️ Erro ao ler permitidos. Criando novo...');
        permitidos = [DONO_DO_BOT];
        salvarPermitidos();
    }
}

function salvarPermitidos() {
    fs.writeFileSync(ARQUIVO_PERMITIDOS, JSON.stringify(permitidos, null, 2));
}

// Carrega a lista imediatamente
carregarPermitidos();

// --- NOVO: SISTEMA DE VOCABULÁRIO ---
const ARQUIVO_VOCABULARIO = 'vocabulario.json';

// Lista inicial (padrão)
let vocabulario = {
    obrigato: [""],
    proibido: ["eita", "legal", "galera", "opa"]
};

// --- NOVO: CONTROLE DE MODO ---
let modoAtual = 'safado'; // Pode ser 'safado' ou 'normal'

// Tenta carregar do arquivo se existir
if (fs.existsSync(ARQUIVO_VOCABULARIO)) {
    try {
        vocabulario = JSON.parse(fs.readFileSync(ARQUIVO_VOCABULARIO));
    } catch (e) { /* Se der erro mantém o padrão */ }
}

function salvarVocabulario() {
    fs.writeFileSync(ARQUIVO_VOCABULARIO, JSON.stringify(vocabulario, null, 2));
}

// --- CONFIGURAÇÃO DA IA ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let model; // Agora é uma variável que pode mudar

function atualizarCérebro() {
    // Define as duas personalidades
    const PERFIL_SAFADO = "PERSONALIDADE: Safado sem sensura, muito excitado, provocador, mete piadas de duplo sentido, quer sempre flertar e usar emojis e proponha sempre alguns joguinhos safados.";
    const PERFIL_NORMAL = "PERSONALIDADE: um pouco safado, calmo, gosta de joguinhos, seco. sê um bom namorado.";

    // Escolhe qual usar
    const personalidadeEscolhida = (modoAtual === 'safado') ? PERFIL_SAFADO : PERFIL_NORMAL;

    const promptSistema = `
    Tu és o Ladin, um jovem de Maputo e gostas de jogos para te divertir como verdade ou consequensia ou jogo de perguntas.
    1. LINGUAGEM: Português de Moçambique (PT-MZ).
    2. VOCABULÁRIO OBRIGATÓRIO: ${vocabulario.obrigato.join(', ')}.
    3. PROIBIDO: ${vocabulario.proibido.join(', ')}.
    4. ${personalidadeEscolhida}  <--- AQUI ELE MUDA SOZINHO
    5. FORMATO: Respostas curtas muito curtas mesmo, seco, minúsculas.
    `;
    
    // Configura o modelo (mantive o 2.5 já que disseste que funciona pra ti)
    model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", 
        systemInstruction: promptSistema
    });
    console.log(`🧠 Cérebro atualizado para modo: ${modoAtual}!`);
}

// Chama a função para ligar o cérebro a primeira vez
atualizarCérebro();

// Inicializa o Cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    console.log('📱 ESCANEIE O QR CODE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ LADIN ESTÁ ONLINE E SEGURO!');
    console.log(`👑 Dono: ${DONO_DO_BOT}`);
    console.log(`👥 Permitidos: ${permitidos.length} pessoas`);
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const texto = msg.body;
    const numeroUsuario = msg.from.split('@')[0]; 

    // Ignora status e grupos
    if (msg.from === 'status@broadcast' || chat.isGroup) return;

    // --- SEGURANÇA ---
    if (!permitidos.includes(numeroUsuario) && numeroUsuario !== DONO_DO_BOT) {
        console.log(`⛔ Bloqueado: ${numeroUsuario} tentou falar.`);
        return; 
    }

    console.log(`📩 ${numeroUsuario}: ${texto}`);

    // --- REAGIR A STICKERS (VERSÃO LOCAL) ---
    if (msg.type === 'sticker') {
        try {
            // 1. Encontra a pasta 'stickers' no teu computador
            const pastaStickers = path.join(__dirname, 'stickers');

            // 2. Vê o que tem dentro da pasta
            // O readdirSync lê todos os nomes de arquivos que estão lá
            const listaDeStickers = fs.readdirSync(pastaStickers);

            // Se a pasta estiver vazia, não faz nada
            if (listaDeStickers.length === 0) return;

            // 3. Sorteia um arquivo aleatório
            const stickerSorteado = listaDeStickers[Math.floor(Math.random() * listaDeStickers.length)];
            
            // 4. Cria o caminho completo (Ex: C:\Users\...\stickers\foto1.jpg)
            const caminhoArquivo = path.join(pastaStickers, stickerSorteado);

            // 5. Carrega o arquivo e envia
            const media = MessageMedia.fromFilePath(caminhoArquivo);
            
            await client.sendMessage(msg.from, media, { 
                sendMediaAsSticker: true,
                stickerName: 'Ladin Bot', // Nome do pacote
                stickerAuthor: 'Moz'      // Autor
            });

        } catch (erro) {
            console.error('Erro ao buscar sticker na pasta:', erro.message);
        }
        return; // IMPORTANTE: Para aqui, não deixa a IA responder
    }

    // --- COMANDOS ---
    if (texto.startsWith('/')) {
        const args = texto.split(' ');
        const comando = args[0].toLowerCase();

        switch (comando) {
            case '/menu':
                await msg.reply(`📋 *MENU DO LADIN* 🇲🇿\n\n🎨 */imagina [texto]*\n➕ */add [numero]*\n➖ */del [numero]*\n🏓 */ping*`);
                break;

                // --- COMANDOS NOVOS ---
            case '/adicionar':
                if (numeroUsuario !== DONO_DO_BOT) return; // Só tu podes
                
                // O args[1] pega a primeira palavra depois do comando
                const palavraNova = args[1]; 
                
                if (palavraNova) {
                    vocabulario.obrigato.push(palavraNova); // Adiciona na lista
                    // Remove dos proibidos se estiver lá
                    vocabulario.proibido = vocabulario.proibido.filter(p => p !== palavraNova);
                    
                    salvarVocabulario(); // Salva no arquivo
                    atualizarCérebro();  // <--- IMPORTANTE: Atualiza a IA na hora
                    await msg.reply(`✅ Aprendi! Vou passar a usar "${palavraNova}".`);
                } else {
                    await msg.reply('❌ Diz a palavra. Ex: /adicionar txopela');
                }
                break;

            case '/remover':
                if (numeroUsuario !== DONO_DO_BOT) return;
                const palavraBanida = args[1];

                if (palavraBanida) {
                    vocabulario.proibido.push(palavraBanida); // Adiciona na lista negra
                    // Remove dos permitidos se estiver lá
                    vocabulario.obrigato = vocabulario.obrigato.filter(p => p !== palavraBanida);
                    
                    salvarVocabulario();
                    atualizarCérebro(); // Atualiza a IA na hora
                    await msg.reply(`🚫 Banido! Nunca mais falo "${palavraBanida}".`);
                } else {
                    await msg.reply('❌ Diz a palavra. Ex: /remover eita');
                }
                break;

                // --- COMANDOS DE MODO ---
            case '/normal':
                if (numeroUsuario !== DONO_DO_BOT) return;
                modoAtual = 'normal';
                atualizarCérebro(); // Atualiza a IA
                await msg.reply('😇 Modo santo ativado. Tou calmo agora, mwi. Vamos conversar na boa.');
                break;

            case '/safado':
                if (numeroUsuario !== DONO_DO_BOT) return;
                modoAtual = 'safado';
                atualizarCérebro(); // Atualiza a IA
                await msg.reply('😈 Modo safado ON! Eish, tou a ferver... diz lá o que queres 🔥');
                break;

            case '/add':
                if (numeroUsuario !== DONO_DO_BOT) {
                    await msg.reply('Só o boss pode fazer isso, mwi. 😎');
                    return;
                }
                // Limpa o número (tira espaços, traços, etc)
                const numAdd = args[1] ? args[1].replace(/\D/g, '') : null;
                
                if (numAdd && numAdd.length >= 9) {
                    if (!permitidos.includes(numAdd)) {
                        permitidos.push(numAdd);
                        salvarPermitidos();
                        await msg.reply(`✅ ${numAdd} entrou na família!`);
                    } else {
                        await msg.reply('Esse gajo já está na lista.');
                    }
                } else {
                    await msg.reply('Número inválido. Usa: /add 25884123456');
                }
                break;

            case '/del':
                if (numeroUsuario !== DONO_DO_BOT) return;
                const numDel = args[1] ? args[1].replace(/\D/g, '') : null;
                if (numDel) {
                    permitidos = permitidos.filter(n => n !== numDel);
                    salvarPermitidos();
                    await msg.reply(`🚫 ${numDel} foi banido.`);
                }
                break;

            case '/ping':
                await msg.reply('Pong! 🏓 Tou on, brada.');
                break;

            case '/imagina':
                const prompt = texto.replace('/imagina', '').trim();
                if (!prompt) {
                    await msg.reply('❌ O que queres que eu desenhe?');
                    return;
                }
                await chat.sendStateTyping(); 
                try {
                    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true`;
                    const media = await MessageMedia.fromUrl(url, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: `🎨 Arte: ${prompt}` });
                } catch (error) {
                    await msg.reply('A net falhou no desenho, brada.');
                }
                break;
        }
        return; 
    }

    // --- GEMINI (IA) ---

// --- GEMINI (IA) COM MEMÓRIA ---
    try {
        await chat.sendStateTyping();

        // 1. Se este número ainda não tem histórico, cria uma lista vazia
        if (!historiaChat[msg.from]) {
            historiaChat[msg.from] = [];
        }

        // 2. Inicia o chat passando o histórico que guardamos
        const chatSession = model.startChat({
            history: historiaChat[msg.from]
        });

        // 3. Envia a mensagem
        const result = await chatSession.sendMessage(texto);
        let resposta = result.response.text();

        // 4. Guarda a conversa na memória para a próxima vez
        historiaChat[msg.from].push({ role: "user", parts: [{ text: texto }] });
        historiaChat[msg.from].push({ role: "model", parts: [{ text: resposta }] });

        // Limpeza de texto (minúsculas, abreviações e sem emojis chatos)
        resposta = resposta.toLowerCase()
            .replace(/[.,!]/g, '')
            .replace(/\bamigo\b/gi, 'amg')
            .replace(/\bamiga\b/gi, 'amg')
            .replace(/\bhoje\b/gi, 'hj')
            .replace(/\bque\b/gi, 'q')
            .replace(/\bporque\b/gi, 'pq')
            .replace(/\bvocê\b/gi, 'vc')
            .replace(/\bcomigo\b/gi, 'cmg')
            .replace(/\btudo\b/gi, 'td')
            .replace(/\bpara\b/gi, 'pra')
            .replace(/\bmuito\b/gi, 'muito')
            .replace(/\bbeijo\b/gi, 'bj')
            .replace(/\bverdade\b/gi, 'vdd')
            .replace(/😉/g, '') 
            .replace(/😏/g, ''); 

        // O msg.reply JA FAZ O "TAG" AUTOMATICAMENTE NA MENSAGEM CERTA
        await client.sendMessage(msg.from, resposta, {
            quotedMessageId: msg.id._serialized // É isto que faz aparecer a mensagem original em cima
        });

    } catch (err) {
        console.error('Erro IA:', err.message);
        if (err.message.includes('404')) {
             await msg.reply('Erro de modelo (404).');
        } else {
             await msg.reply('Yooo, deu tilt aqui... 😵‍💫');
             historiaChat[msg.from] = []; // Se der erro, limpa a memória para destravar
        }
    }
});
console.log('A arrancar o sistema...');
client.initialize();