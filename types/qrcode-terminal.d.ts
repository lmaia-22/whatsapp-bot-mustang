declare module 'qrcode-terminal' {
    interface QRCodeOptions {
        small?: boolean;
    }

    interface QRCodeTerminal {
        generate(text: string, options?: QRCodeOptions): void;
    }

    const qrcode: QRCodeTerminal;
    export default qrcode;
}