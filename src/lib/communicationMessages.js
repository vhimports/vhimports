const emoji = {
  sparkle: '\u2728',
  gem: '\u{1F48E}',
  whiteHeart: '\u{1F90D}',
  ring: '\u{1F48D}',
  card: '\u{1F4B3}',
  cake: '\u{1F382}',
}

const option = (number) => `${number}\uFE0F\u20E3`

export const pixKey = import.meta.env?.VITE_PIX_KEY || 'chave PIX configurada no painel'

export function normalizeWhatsAppText(text) {
  return String(text).normalize('NFC')
}

export function whatsappUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '')
  const number = digits.startsWith('55') ? digits : `55${digits}`
  if (number.length <= 2) return ''
  const query = new URLSearchParams({ text: normalizeWhatsAppText(text ?? '') })
  return `https://wa.me/${number}?${query.toString()}`
}

export function receivableMessage({ name = 'cliente', amount, dueDate }) {
  return normalizeWhatsAppText(`${emoji.sparkle} Olá, ${name}! Tudo bem?
Passando para lembrar que o pagamento referente à sua compra na *VH Imports* está pendente no valor de *${amount}*, com vencimento em *${dueDate}*.
${emoji.card} Você pode realizar o pagamento pela chave PIX abaixo:
*${pixKey}*
Caso o pagamento já tenha sido efetuado, por favor, desconsidere esta mensagem e, se possível, envie o comprovante. ${emoji.gem}
Se precisar de alguma informação ou desejar combinar uma nova data, estamos à disposição para ajudar. ${emoji.whiteHeart}
Atenciosamente,
*VH Imports | Tênis importados* ${emoji.sparkle}`)
}

export function birthdayMessage(name = 'cliente') {
  return normalizeWhatsAppText(`${emoji.sparkle} Olá, ${name}! Hoje é um dia muito especial: o seu aniversário! ${emoji.cake}
A VH Imports deseja a você um novo ciclo cheio de alegria, saúde e bons momentos. ${emoji.whiteHeart}
Para comemorar, queremos presentear você com 10% de desconto na sua próxima compra de tênis importados. ${emoji.gem}
Quando escolher seu próximo modelo, fale com a gente para aplicarmos o desconto.
Feliz aniversário!
*VH Imports | Tênis importados* ${emoji.sparkle}`)
}

export const winbackMessages = {
  newPieces: (name) => normalizeWhatsAppText(`${emoji.sparkle} Olá, ${name}! Temos novidades na *VH Imports*! ${emoji.gem}
Acabaram de chegar novos modelos de *tênis importados*, escolhidos para acompanhar diferentes estilos. ${emoji.whiteHeart}
Quer receber as novidades em primeira mão?
Responda com uma das opções:
*${option(1)} Quero ver as novidades*
*${option(2)} Quero ver Nike* ${emoji.ring}
*${option(3)} Quero ver Adidas* ${emoji.sparkle}
*${option(4)} Quero ver Asics* ${emoji.whiteHeart}
*${option(5)} Quero ver New Balance* ${emoji.gem}
É só responder com o número da opção desejada! Será um prazer ajudar você a encontrar seu próximo modelo. ${emoji.sparkle}
*VH Imports | Tênis importados*`),
  buyAgain: (name) => normalizeWhatsAppText(`${emoji.sparkle} Olá, ${name}! Sentimos sua falta por aqui! ${emoji.whiteHeart}
Já faz algum tempo desde a sua última compra na *VH Imports*, e queremos convidar você para conhecer os novos modelos que acabaram de chegar. ${emoji.gem}
São tênis importados selecionados para combinar com diferentes estilos e momentos. ${emoji.sparkle}
O que você gostaria de ver?
*${option(1)} Novidades*
*${option(2)} Nike* ${emoji.ring}
*${option(3)} Adidas* ${emoji.sparkle}
*${option(4)} Asics* ${emoji.whiteHeart}
*${option(5)} New Balance* ${emoji.gem}
Responda com o número da opção desejada e enviaremos uma seleção especial para você!
*VH Imports | Tênis importados* ${emoji.sparkle}`),
}
