import {Telegraf} from 'telegraf'
import {NextResponse} from 'next/server';

const FETCH_TIMEOUT_MS = 5000;

class Telegram {
    client: Telegraf;
    channelId: string;

    constructor() {
        this.client = new Telegraf(String(process.env.BOT_TOKEN));
        this.channelId = String(process.env.CHANNEL_ID);
    }

    async sendMessage(message: string) {
        await this.client.telegram.sendMessage(this.channelId, message);
    }
}

export async function GET() {
    const monitoringHosts = process.env.MONITORING_HOSTS;

    if (!monitoringHosts) {
        return new Response(null, {status: 400});
    }


    const telegram = new Telegram();
    const monitoringHostsList = monitoringHosts.split(',').map(host => host.trim());

    const result = await Promise.all(monitoringHostsList.map(async (host) => fetch(`https://${host}`, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)}).then(() => null).catch(err => ({
        host,
        err
    }))));

    await Promise.all(result.filter((x): x is { host: string, err: unknown } => x !== null).map(({host, err}) => {
        if (!(err instanceof Error)) {
            console.log(err);
            return;
        }

        if (err.name === "TimeoutError") {
            return telegram.sendMessage(`TimeoutError ${FETCH_TIMEOUT_MS} for host: ${host}`);
        }

        const cause = err.cause as {code?: string};

        if (cause?.code === "CERT_HAS_EXPIRED") {
            return telegram.sendMessage(`CERT_HAS_EXPIRED Error for host: ${host}`);
        }

        if (cause?.code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY") {
            return telegram.sendMessage(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY Error for host: ${host}`);
        }

        if (cause?.code === 'ENOTFOUND') {
            return telegram.sendMessage(`GET Address Info Error for host: ${host}`);
        }

        return telegram.sendMessage(`Unknown Error: ${err}, for host: ${host}`);

    }));


    return NextResponse.json({ok: true});
}
