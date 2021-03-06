(function() {

var nil_ops = {
  "NOP"  : "0",
  "HALT" : "1"
};

var mem_ops = {
  "LB" : "0010",
  "SB" : "0100"
};

var imm_ops = {
  "ADDI" : "0101",
  "ORI"  : "0111",
  "ANDI" : "0110",

  "BEQ"  : "1000",
  "BNE"  : "1001"
};

var rtype_funcs = {
  "ADD" : "000", 
  "SUB" : "001",
  "SRA" : "010",
  "SRL" : "011",
  "SLL" : "100",
  "AND" : "101",
  "OR"  : "110"
};

var branch_one = {
  "BGEZ" : "1010",
  "BLTZ" : "1011"
};

function rem_whitespace(str) {
  return str.replace(/\s+|\t+/g, ' ');
}

var labels = {};

function match_label(str) {
  return str.match(/^(#(([a-z]|[A-Z]|_|\d)+))/);
}

function process_label(instr, line, addr) {
  var cleaned = rem_whitespace($.trim(instr.replace(/,+/g, '').replace(/\(|\)/g, ' ').toUpperCase()));
  var m = match_label(cleaned);
  if (m) {
    var lbl = m[2];
    labels[lbl] = addr;
  }
  return cleaned;
}

// Extract the bytecode for a single instruction [instr].
function bytecode(instr, line, addr) {
  // Throw an error message and exit the program.
  function error(msg) {
    throw "Parse error" + (line || line === 0 ? " on line " + (line + 1) : "") + ": " + msg; 
  }
  // Get x from a string like "Rx"
  function reg_num(str) {
    var n = parseInt(str.replace(/R/g, ''), 10);
    if (n < 0 || n > 7) {
      error("Invalid register number.");
    }
    return num_to_bin(n, 3);
  }
  // Get the sign-extended 6-bit immediate value from str
  function imm_num(str) {
    var n, m, errmsg;
    m = match_label(str);
    if (m) {
      if (labels[m[2]] === undefined) {
        error("Undefined label " + m[2]);
      }
      console.log(m[2] + " has offset " + (2 * (labels[m[2]] - (1 + addr))));
      console.log(addr);
      console.log(labels[m[2]]);
      n = 2 * (labels[m[2]] - (addr + 1));
      errmsg = "Branch offset exceeds 6-bit representable range.";
    } else if (!str.match(/^-?\d+/)) {
      error("Invalid immediate value.");
    } else {
      n = parseInt(str, 10);
      errmsg = "Immediate value exceeds 6-bit representable range.";
    }
    if (n < -32 || n > 31) {
      error(errmsg);
    }
    return num_to_bin(n, 6);
  }
  // Convert [num] to a 2's complement binary number with length [bits].
  function num_to_bin(num, bits) {
    compl = num < 0;
    num = Math.abs(num);
    var bin = "";
    var mask = 1;
    for (var i = 0; i < bits; i++) {
      bin = (num & mask ? "1" : "0") + bin;
      mask <<= 1;
    }
    if (compl) {
      r = bin.match(/(.*)(10*)$/);
      inv = r[1].replace(/0/g, 'T')
                .replace(/1/g, '0')
                .replace(/T/g, '1');
      bin = inv + r[2];
    }
    return bin;
  }
  var m = match_label(instr);
  if (m) {
    instr = $.trim(instr.replace(m[0], ""));
  }
  var toks = instr.split(' ');
  console.log(toks);
  var op = toks[0];
  // "Nil"-type instructions
  var n_func = nil_ops[op];
  if (n_func) {
    return num_to_bin(0, 15) + n_func;
  }
  // Immediate-type instructions
  var i_op = imm_ops[op];
  var rs, rt, rd, imm;
  if (i_op) {
    if (toks.length == 4) {
      rt = reg_num(toks[1]);
      rs = reg_num(toks[2]);
      imm = imm_num(toks[3]);
    } else if (toks.length == 3) {
      rs = reg_num(toks[1]);
      rt = "000";
      imm = imm_num(toks[2]);
    } else {
      error("Invalid imm. instruction format");
    }
    return i_op + rs + rt + imm;
  }
  // R-Type instructions
  var func = rtype_funcs[op];
  if (func) {
    rd = reg_num(toks[1]);
    rs = reg_num(toks[2]);
    rt = toks[3] ? (reg_num(toks[3])) : "000";
    return "1111" + rs + rt + rd + func;
  }
  // Memory instructions
  var m_op = mem_ops[op];
  if (m_op) {
    rt = reg_num(toks[1]);
    imm = imm_num(toks[2]);
    rs = reg_num(toks[3]);
    return m_op + rs + rt + imm;
  }
  // Branch (single register) instructions
  var b_op = branch_one[op];
  if (b_op) {
    rs = reg_num(toks[1]);
    imm = imm_num(toks[2]);
    rt = "000";
    return b_op + rs + rt + imm;
  }
  error("Invalid instruction type.");
}

function parse_all() {
  var start = parseInt($('#start').val(), 10) || 0,
      offs1 = 0, 
      offs2 = 0;
  labels = {};
  // Determines branch offset for labels and cleans up an instruction
  function pass1(instr, i) {
    if(instr == "") {
      --offs1;
      return "";
    }
    return process_label(instr, i, i + start + offs1);
  }
  // Converts the instructions to bytecode
  function pass2(instr, i) {
    var addr;
    if (instr == "") {
      --offs2;
      return "\n";
    }
    addr = i + start + offs2;
    return "mem[" + addr + "] <= 16'b" + bytecode(instr, i, addr) + 
            "; // " + $.trim(instr) + '\n';
  }
  var instrs = $('#instructions').val().split('\n');
  $('#verilog').val('');
  try {
    var instrs_cleaned = $.map(instrs, pass1);
    var results = $.map(instrs_cleaned, pass2);
    console.log(results);
    $(results).each(function(_, res) {
      $('#verilog').val($('#verilog').val() + res);
    });
  } catch (error) {
    $('#verilog').val('There was an error processing your code:\n' + error);
  }
}

$(document).ready(function() {
  // Allow only numeric inputs: http://stackoverflow.com/a/15832211
  $('#start').keydown(function (e) {
    function isSysKey(code) {
    return (code === 40 || code === 38 ||
            code === 13 || code === 39 || code === 27 ||
            code === 35 ||
            code === 36 || code === 37 || code === 38 ||
            code === 16 || code === 17 || code === 18 ||
            code === 20 || code === 37 || code === 9 ||
            (code >= 112 && code <= 123));
    }
    var code = (e.keyCode ? e.keyCode : e.which), value;
    if (isSysKey(code) || code === 8 || code === 46) return true;
    if (e.shiftKey || e.altKey || e.ctrlKey) return;
    if (code >= 48 && code <= 57) return true;
    if (code >= 96 && code <= 105) return true;
    return false;
  });
  $('#convert').click(parse_all);
});

})();