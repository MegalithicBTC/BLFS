// Purpose: Thank-you page UI extension; renders "Complete payment" and passes orderName + short desc.
// Called by: Shopify runtime after install; deployed by /dev deploy.
import {reactExtension, Button, BlockStack, Text, useApi} from '@shopify/ui-extensions-react/checkout';
import {useEffect, useState} from 'react';

function toTitleish(s) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return clean.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}
function summarizeLineItems(items) {
  const arr = Array.isArray(items) ? items : [];
  const parts = arr.map((x) => {
    const qty = Number(x?.quantity || 0);
    const title = toTitleish(x?.title || x?.name || '');
    const variant = toTitleish(x?.variantTitle || x?.variant_title || '');
    const name = variant ? `${title} (${variant})` : title;
    return `${qty}× ${name}`.trim();
  }).filter(Boolean);
  const head = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${head}, +${parts.length - 3} more` : head;
}

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <Extension />,
);

function Extension() {
  const api = useApi();
  const [paymentUrl, setPaymentUrl] = useState('');

  useEffect(() => {
    const sub = api.orderConfirmation?.subscribe((oc) => {
      const domain = "__APP_DOMAIN__";
      const shopPublicId = "__PUBLIC_ID__";

      const amount = api.cost?.current?.totalAmount?.amount || api.cost?.current?.subtotalAmount?.amount || 0;
      const currency = api.cost?.current?.totalAmount?.currencyCode || 'USD';

      const orderId = oc?.order?.id || '';
      const orderName = oc?.order?.name || '';
      const shopDomain = api.shop?.myshopifyDomain;

      const li = oc?.order?.lineItems || oc?.lineItems || [];
      const desc = summarizeLineItems(li);

      const url = new URL(`https://${domain}/pay/${shopPublicId}`);
      url.searchParams.set('amount', String(amount));
      url.searchParams.set('currency', String(currency));
      url.searchParams.set('orderGid', String(orderId));
      url.searchParams.set('orderName', String(orderName || ''));
      url.searchParams.set('shopDomain', String(shopDomain || ''));
      if (desc) url.searchParams.set('desc', desc);

      setPaymentUrl(url.toString());
    });

    return () => { try { sub?.unsubscribe(); } catch {} };
  }, []);

  if (!paymentUrl) return null;

  return (
    <BlockStack spacing="base">
      <Text size="large"> ₿ Pay with Bitcoin</Text>
      <Button onPress={() => api.navigation.openExternal(paymentUrl)}>
        Complete Payment With Bitcoin Lightning
      </Button>
    </BlockStack>
  );
}