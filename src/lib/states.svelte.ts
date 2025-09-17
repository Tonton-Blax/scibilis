function buildFfmpegMessage() {
    let messages = $state<string[]>([]);
    let lastMessage = $derived(messages.length ? messages[messages.length - 1] : '');
    let error = $state(false);
    return {
        get messages() { return messages },
        clear() { messages = []; error = false; },
        add(val: string) { messages.push(val); },
        get error() { return error },
        set error(val: boolean) { error = val; },
        get lastMessage() { return lastMessage; }
    }
}

function buildToast() {
    let show = $state(false);
    let message = $state('');
    let timeout: NodeJS.Timeout;
    let color = $state<"red" | "primary" | "gray" | "orange" | "green">('primary');

    function trigger(msg: string, color: 'blue' | 'red' | 'green' = 'blue', duration = 3000) {
        message = msg;
        color = color;
        show = true;
        clearTimeout(timeout);
        timeout = setTimeout(() => show = false, duration);
    }

    function close() {
        show = false;
        clearTimeout(timeout);
    }

    return {
        get show() { return show },
        set show(val: boolean) { show = val },
        get message() { return message },
        get color() { return color },
        trigger,
        close
    }
}
export const ffmpegMessage = buildFfmpegMessage();
export const toast = buildToast();
