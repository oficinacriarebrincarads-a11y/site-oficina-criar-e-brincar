// API de Conversões do Meta: recebe os eventos da página e reenvia ao Meta pelo servidor.
// O token fica na variável de ambiente META_CAPI_TOKEN (cadastrada no painel da Netlify),
// nunca no código. O mesmo event_id é enviado pelo Pixel, então o Meta não conta em dobro.

const PIXEL_ID = '611972390791603';
const EVENTOS = ['PageView', 'ViewContent', 'InitiateCheckout'];
const ORIGEM = 'https://oficinacriarebrincar.com.br';

export default async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const token = process.env.META_CAPI_TOKEN;
  if (!token) return new Response(null, { status: 204 });

  let corpo;
  try { corpo = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }

  const { event_name, event_id, event_source_url, custom_data, fbp, fbc, test_event_code } = corpo || {};
  if (!EVENTOS.includes(event_name) || typeof event_id !== 'string' || typeof event_source_url !== 'string' || !event_source_url.startsWith(ORIGEM)) {
    return new Response(null, { status: 400 });
  }

  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const user_data = { client_user_agent: req.headers.get('user-agent') || '' };
  if (ip) user_data.client_ip_address = ip;
  if (typeof fbp === 'string' && fbp) user_data.fbp = fbp;
  if (typeof fbc === 'string' && fbc) user_data.fbc = fbc;

  const payload = {
    data: [{
      event_name,
      event_id: event_id.slice(0, 100),
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: event_source_url.slice(0, 500),
      user_data,
      custom_data: custom_data && typeof custom_data === 'object' ? custom_data : undefined,
    }],
  };
  if (typeof test_event_code === 'string' && /^TEST\w+$/.test(test_event_code)) payload.test_event_code = test_event_code;

  const resp = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) console.error('Meta CAPI', resp.status, await resp.text());

  return new Response(null, { status: 204 });
};
