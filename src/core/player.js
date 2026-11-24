// mod2sid – 6502 playroutine with GoatTracker-2 compatible semantics
// (c) IT-DUMMKOPFEN, GPL-3.0
// Data symbols are supplied by sidbuild.js. GATE is the gate/hard-restart timer.
const PLAYER_SRC = String.raw`
ZP = $FB
ZP2 = $FD
        jmp init
        jmp play

; ---------------------------------------------------------------- init
init:   CLEARSID
        ldx #VARSIZE
        lda #0
clvar:  sta VARS-1,x
        dex
        bne clvar
        lda #INITTEMPO
        sta tempo
        lda #$0F
        sta mvol
        ldx #NVM1
ivoice: lda #$FE
        sta gmask,x
        lda #1
        sta instr,x
        jsr nextpat
        jsr fetchrow
        lda #$FE
        sta gmask,x
        dex
        bpl ivoice
        lda #0
        sta tick
        rts

; ---------------------------------------------------------------- play
play:   lda tick
        bne pl_nt0
        ldx #NVM1
pl_ap:  jsr applyrow
        dex
        bpl pl_ap
pl_nt0: lda tempo
        sec
        sbc #GATE
        cmp tick
        bne pl_nof
        ldx #NVM1
pl_fr:  jsr fetchrow
        dex
        bpl pl_fr
pl_nof: ldx #NVM1
pl_vx:  jsr voicefx
        dex
        bpl pl_vx
        jsr filterfx
        inc tick
        lda tick
        cmp tempo
        bcc pl_end
        lda #0
        sta tick
        lda funkon
        beq pl_end
        lda funkidx
        eor #1
        sta funkidx
        tay
        lda funk0,y
        sta tempo
pl_end: rts

; ---------------------------------------------------------------- order / pattern
nextpat:
        lda ORDLO,x
        sta ZP2
        lda ORDHI,x
        sta ZP2+1
np_lp:  ldy ordpos,x
        lda (ZP2),y
        cmp #$FF
        bne np_ok
        iny
        lda (ZP2),y
        sta ordpos,x
        jmp np_lp
np_ok:  tay
        lda PATLO,y
        sta plo,x
        sta ZP
        lda PATHI,y
        sta phi,x
        sta ZP+1
        inc ordpos,x
        ldy #0
        rts

; fetch next pattern row of voice X into pending, perform hard restart
fetchrow:
        lda #$FF
        sta pnote,x
        lda #0
        sta pinst,x
        sta pctl,x
        sta pcmd,x
        sta pdata,x
        lda skip,x
        beq fr_read
        dec skip,x
        jmp fr_hr
fr_read:
        lda plo,x
        sta ZP
        lda phi,x
        sta ZP+1
        ldy #0
fr_ag:  lda (ZP),y
        cmp #$FF
        bne fr_go
        jsr nextpat
        jmp fr_ag
fr_go:  cmp #$E3
        bcc fr_row
        sec
        sbc #$E3
        sta skip,x
        iny
        jmp fr_st
fr_row: sta ytmp2
        iny
        and #$7F
        cmp #$60
        bcs fr_ctl
        sta pnote,x
        jmp fr_ins
fr_ctl: beq fr_ins
        sec
        sbc #$60
        sta pctl,x
fr_ins: lda ytmp2
        bpl fr_cmd
        lda (ZP),y
        sta pinst,x
        iny
fr_cmd: lda (ZP),y
        iny
        and #$0F
        sta pcmd,x
        beq fr_st
        lda (ZP),y
        sta pdata,x
        iny
fr_st:  tya
        clc
        adc ZP
        sta plo,x
        lda ZP+1
        adc #0
        sta phi,x
fr_hr:  lda pnote,x
        bmi fr_done
        lda pcmd,x
        cmp #3
        beq fr_done
        ldy pinst,x
        bne fr_hy
        ldy instr,x
fr_hy:  lda I_GT,y
        and #$40
        bne fr_nog
        lda #$FE
        sta gmask,x
fr_nog: lda I_GT,y
        bmi fr_done
        lda #HRAD
        sta vad,x
        lda #HRSR
        sta vsr,x
fr_done:
        rts

; apply pending row (tick 0)
applyrow:
        lda pinst,x
        beq ap_noi
        sta instr,x
ap_noi: lda pnote,x
        bmi ap_nonote
        ldy pcmd,x
        cpy #3
        bne ap_init
        ; toneportamento: new target only
        sta notenum,x
        tay
        lda FRQLO,y
        sta tflo,x
        lda FRQHI,y
        sta tfhi,x
        jmp ap_nonote
ap_init:
        jsr noteinit
ap_nonote:
        lda pctl,x
        beq ap_cmd
        cmp #1
        bne ap_kon
        lda #$FE
        sta gmask,x
        jmp ap_cmd
ap_kon: lda #$FF
        sta gmask,x
ap_cmd: lda pcmd,x
        cmp #5
        bcs ap_one
        cmp fxcmd,x
        beq ap_same
        sta fxcmd,x
        lda #0
        sta vibtime,x
ap_same: lda pdata,x
        sta fxdata,x
        rts
ap_one: ldy pdata,x
        cmp #5
        bne ap6
        tya
        sta vad,x
        rts
ap6:    cmp #6
        bne ap7
        tya
        sta vsr,x
        rts
ap7:    cmp #7
        bne ap8
        tya
        sta wave,x
        rts
ap8:    cmp #8
        bne ap9
        tya
        sta wavepos,x
        lda #0
        sta wavedel,x
        rts
ap9:    cmp #9
        bne apa
        tya
        sta pulsepos,x
        lda #0
        sta pulsetm,x
        rts
apa:    cmp #$0A
        bne apb
        sty filtpos
        lda #0
        sta filttm
        rts
apb:    cmp #$0B
        bne apc
        sty fctrl
        tya
        bne apb_r
        sta filtpos
apb_r:  rts
apc:    cmp #$0C
        bne apd
        sty fcut
        rts
apd:    cmp #$0D
        bne ape
        tya
        and #$F0
        bne apd_r
        tya
        sta mvol
apd_r:  rts
ape:    cmp #$0E
        bne apf
        lda SPDHI,y
        sta funk0
        sta tempo
        lda SPDLO,y
        sta funk1
        lda #1
        sta funkon
        lda #0
        sta funkidx
        rts
apf:    tya
        and #$7F
        cmp #2
        bcc apf_r
        sta tempo
        lda #0
        sta funkon
apf_r:  rts

; A = note number
noteinit:
        sta notenum,x
        tay
        lda FRQLO,y
        sta flo,x
        lda FRQHI,y
        sta fhi,x
        ldy instr,x
        lda I_AD,y
        sta vad,x
        lda I_SR,y
        sta vsr,x
        lda I_WV,y
        sta wavepos,x
        lda #0
        sta wavedel,x
        sta vibtime,x
        lda I_PU,y
        beq ni_np
        sta pulsepos,x
        lda #0
        sta pulsetm,x
ni_np:  lda I_FI,y
        beq ni_nf
        sta filtpos
        lda #0
        sta filttm
ni_nf:  lda I_VD,y
        sta vibdel,x
        lda #$FF
        sta gmask,x
        lda I_FW,y
        beq ni_nfw
        cmp #$FE
        bcs ni_nfw
        sta wave,x
ni_nfw: lda #1
        sta ninit,x
        rts

; ---------------------------------------------------------------- per-voice effects
voicefx:
        lda ninit,x
        beq vx_wt
        lda #0
        sta ninit,x
        jmp vx_pulse
vx_wt:  ldy wavepos,x
        beq vx_pulse
        lda wavedel,x
        beq wt_go
        dec wavedel,x
        jmp vx_pulse
wt_go:  lda WTL,y
        cmp #$FF
        bne wt_1
        lda WTR,y
        sta wavepos,x
        beq vx_pulse
        tay
        lda WTL,y
wt_1:   cmp #$10
        bcs wt_wav
        cmp #0
        beq wt_note
        sta wavedel,x
        jmp wt_next
wt_wav: cmp #$E0
        bcc wt_set
        cmp #$F0
        bcs wt_next
        and #$0F
wt_set: sta wave,x
wt_note:
        lda WTR,y
        cmp #$80
        beq wt_next
        bcs wt_abs
        cmp #$60
        bcc wt_rel
        clc
        adc #$80
wt_rel: clc
        adc notenum,x
        jmp wt_chk
wt_abs: and #$7F
wt_chk: cmp #96
        bcc wt_f
        lda #95
wt_f:   sty ytmp
        tay
        lda FRQLO,y
        sta flo,x
        lda FRQHI,y
        sta fhi,x
        ldy ytmp
wt_next:
        iny
        tya
        sta wavepos,x

vx_pulse:
        ldy pulsepos,x
        beq pt_done
        lda pulsetm,x
        bne pt_mod
        lda PTL,y
        cmp #$FF
        bne pt_nj
        lda PTR,y
        sta pulsepos,x
        beq pt_done
        tay
        lda PTL,y
pt_nj:  cmp #$80
        bcc pt_sm
        and #$0F
        sta pwhi,x
        lda PTR,y
        sta pwlo,x
        iny
        tya
        sta pulsepos,x
        jmp pt_done
pt_sm:  sta pulsetm,x
        lda PTR,y
        sta pspd,x
        iny
        tya
        sta pulsepos,x
pt_mod: lda pspd,x
        bmi pt_neg
        clc
        adc pwlo,x
        sta pwlo,x
        lda pwhi,x
        adc #0
        jmp pt_st
pt_neg: clc
        adc pwlo,x
        sta pwlo,x
        lda pwhi,x
        adc #$FF
pt_st:  and #$0F
        sta pwhi,x
        dec pulsetm,x
pt_done:
        ; ---- realtime effects (not on tick 0)
        lda tick
        bne fx_go
        jmp vx_out
fx_go:  lda fxcmd,x
        bne fx_cmd
        ; instrument vibrato
        ldy instr,x
        lda I_VD,y
        beq fx_j
        lda vibdel,x
        beq fx_iv
        dec vibdel,x
fx_j:   jmp vx_out
fx_iv:  lda I_VP,y
        beq fx_j
        tay
        jmp do_vib
fx_cmd: ldy fxdata,x
        cmp #1
        bne fx_2
        clc
        lda flo,x
        adc SPDLO,y
        sta flo,x
        lda fhi,x
        adc SPDHI,y
        sta fhi,x
        jmp vx_out
fx_2:   cmp #2
        bne fx_3
        sec
        lda flo,x
        sbc SPDLO,y
        sta flo,x
        lda fhi,x
        sbc SPDHI,y
        sta fhi,x
        bcs fx_2ok
        lda #0
        sta flo,x
        sta fhi,x
fx_2ok: jmp vx_out
fx_3:   cmp #3
        bne fx_4
        cpy #0
        bne tp_go
tp_set: lda tflo,x
        sta flo,x
        lda tfhi,x
        sta fhi,x
        jmp vx_out
tp_go:  lda fhi,x
        cmp tfhi,x
        bne tp_cmp
        lda flo,x
        cmp tflo,x
        beq tp_set
tp_cmp: bcs tp_down
        clc
        lda flo,x
        adc SPDLO,y
        sta flo,x
        lda fhi,x
        adc SPDHI,y
        sta fhi,x
        bcs tp_set
        cmp tfhi,x
        bcc tp_end
        bne tp_set
        lda flo,x
        cmp tflo,x
        bcs tp_set
tp_end: jmp vx_out
tp_down:
        sec
        lda flo,x
        sbc SPDLO,y
        sta flo,x
        lda fhi,x
        sbc SPDHI,y
        sta fhi,x
        bcc tp_set
        cmp tfhi,x
        bcc tp_set
        bne tp_end
        lda flo,x
        cmp tflo,x
        bcc tp_set
        jmp vx_out
fx_4:   cmp #4
        bne vx_out
do_vib: lda SPDHI,y
        sta vspeed
        lda SPDLO,y
        sta vdepth
        lda vibtime,x
        cmp #$80
        bcs vb_1
        cmp vspeed
        beq vb_1
        bcc vb_1
        eor #$FF
vb_1:   clc
        adc #2
        sta vibtime,x
        and #1
        bne vb_dn
        clc
        lda flo,x
        adc vdepth
        sta flo,x
        lda fhi,x
        adc #0
        sta fhi,x
        jmp vx_out
vb_dn:  sec
        lda flo,x
        sbc vdepth
        sta flo,x
        lda fhi,x
        sbc #0
        sta fhi,x

vx_out: ldy SIDOFF,x
        lda flo,x
        sta $D400,y
        lda fhi,x
        sta $D401,y
        lda pwlo,x
        sta $D402,y
        lda pwhi,x
        sta $D403,y
        lda vad,x
        sta $D405,y
        lda vsr,x
        sta $D406,y
        lda wave,x
        and gmask,x
        sta $D404,y
        rts

; ---------------------------------------------------------------- filter
filterfx:
        ldy filtpos
        beq ff_out
        lda filttm
        bne ff_mod
        lda FTL,y
        cmp #$FF
        bne ff_nj
        lda FTR,y
        sta filtpos
        beq ff_out
        tay
        lda FTL,y
ff_nj:  cmp #$80
        bcc ff_nset
        and #$70
        sta ftype
        lda FTR,y
        sta fctrl
        iny
        sty filtpos
        lda FTL,y
        bne ff_out
ff_nset:
        cmp #0
        bne ff_sm
        lda FTR,y
        sta fcut
        iny
        sty filtpos
        jmp ff_out
ff_sm:  sta filttm
        lda FTR,y
        sta fspd
        iny
        sty filtpos
ff_mod: lda fcut
        clc
        adc fspd
        sta fcut
        dec filttm
ff_out: lda #0
        sta $D415
        lda fcut
        sta $D416
        lda fctrl
        sta $D417
        lda ftype
        ora mvol
        sta $D418
SID2OUT
        rts

SIDOFF: .byte SIDOFFS
; ---------------------------------------------------------------- variables
VARS:
tick:    .byte 0
tempo:   .byte 0
funkon:  .byte 0
funkidx: .byte 0
funk0:   .byte 0
funk1:   .byte 0
mvol:    .byte 0
ytmp:    .byte 0
ytmp2:   .byte 0
vspeed:  .byte 0
vdepth:  .byte 0
filtpos: .byte 0
filttm:  .byte 0
fspd:    .byte 0
fcut:    .byte 0
fctrl:   .byte 0
ftype:   .byte 0
ordpos:  .byte VBYTES
plo:     .byte VBYTES
phi:     .byte VBYTES
skip:    .byte VBYTES
pnote:   .byte VBYTES
pinst:   .byte VBYTES
pctl:    .byte VBYTES
pcmd:    .byte VBYTES
pdata:   .byte VBYTES
instr:   .byte VBYTES
notenum: .byte VBYTES
ninit:   .byte VBYTES
fxcmd:   .byte VBYTES
fxdata:  .byte VBYTES
vibtime: .byte VBYTES
vibdel:  .byte VBYTES
wavepos: .byte VBYTES
wavedel: .byte VBYTES
pulsepos: .byte VBYTES
pulsetm: .byte VBYTES
pspd:    .byte VBYTES
wave:    .byte VBYTES
gmask:   .byte VBYTES
vad:     .byte VBYTES
vsr:     .byte VBYTES
pwlo:    .byte VBYTES
pwhi:    .byte VBYTES
flo:     .byte VBYTES
fhi:     .byte VBYTES
tflo:    .byte VBYTES
tfhi:    .byte VBYTES
VARSEND:
VARSIZE = VARSEND - VARS
`;

// nv = 3 * number of SIDs (1, 2, 4, 6 or 8); SID k sits at $D400 + k * $20
export function playerAsm(nv = 3) {
  const nsid = Math.ceil(nv / 3);
  const zeros = new Array(nv).fill(0).join(',');
  const offs = Array.from({ length: nv }, (_, v) => Math.floor(v / 3) * 32 + (v % 3) * 7).join(',');
  let extra = '';
  for (let k = 1; k < nsid; k++) {
    const b = 0xD400 + k * 32;
    extra += `        lda #0\n        sta $${(b + 0x17).toString(16).toUpperCase()}\n        lda mvol\n        sta $${(b + 0x18).toString(16).toUpperCase()}\n`;
  }
  const clear = nsid > 1
    ? `ldx #0\n        lda #0\nclsid:  sta $D400,x\n        inx\n        bne clsid`
    : `ldx #$18\n        lda #0\nclsid:  sta $D400,x\n        dex\n        bpl clsid`;
  return PLAYER_SRC.replace('CLEARSID', clear).replace(/VBYTES/g, zeros).replace('SIDOFFS', offs).replace('SID2OUT', extra.replace(/\n$/, '')).replace(/NVM1/g, String(nv - 1));
}
export const PLAYER_ASM = playerAsm(3);
