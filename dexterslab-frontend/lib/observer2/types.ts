export interface EyeState {
    ix: number;
    iy: number;
    dilation: number;
    blink: number;
    emotion: string;
    sentinel: boolean;
    visible: boolean;
    entityCount: number;
    overlayText: string;
    overlayType: string;
    blush: number;
    goodBoy: number;
    thankYou: number;
    t: number;
}

export interface OracleResponse {
    response: string;
    category: string;
    emotion: string;
}
