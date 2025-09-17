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

// User management state
function buildUserState() {
    let users = $state<any[]>([]);
    let currentUser = $state<any>(null);
    let isLoading = $state(false);
    let error = $state<string | null>(null);
    
    return {
        get users() { return users },
        set users(value: any[]) { users = value },
        
        get currentUser() { return currentUser },
        set currentUser(value: any) { currentUser = value },
        
        get isLoading() { return isLoading },
        set isLoading(value: boolean) { isLoading = value },
        
        get error() { return error },
        set error(value: string | null) { error = value },
        
        reset() {
            users = [];
            currentUser = null;
            isLoading = false;
            error = null;
        },
        
        addUser(user: any) {
            users.push(user);
        },
        
        updateUser(userId: string, updatedUser: any) {
            const index = users.findIndex(u => u.id === userId);
            if (index !== -1) {
                users[index] = { ...users[index], ...updatedUser };
            }
        },
        
        removeUser(userId: string) {
            users = users.filter(u => u.id !== userId);
        }
    };
}

// User form state
function buildUserFormState() {
    let formData = $state({
        username: '',
        email: '',
        name: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        isActive: true,
        bio: ''
    });
    
    let errors = $state<Record<string, string>>({});
    let isSubmitting = $state(false);
    
    return {
        get formData() { return formData },
        set formData(value: any) { formData = value },
        
        get errors() { return errors },
        set errors(value: Record<string, string>) { errors = value },
        
        get isSubmitting() { return isSubmitting },
        set isSubmitting(value: boolean) { isSubmitting = value },
        
        reset() {
            formData = {
                username: '',
                email: '',
                name: '',
                password: '',
                confirmPassword: '',
                role: 'user',
                isActive: true,
                bio: ''
            };
            errors = {};
            isSubmitting = false;
        },
        
        setField(field: string, value: any) {
            formData = { ...formData, [field]: value };
            // Clear error for this field when it changes
            if (errors[field]) {
                errors = { ...errors, [field]: '' };
            }
        },
        
        setFieldError(field: string, error: string) {
            errors = { ...errors, [field]: error };
        },
        
        clearErrors() {
            errors = {};
        }
    };
}

export const userState = buildUserState();
export const userFormState = buildUserFormState();
