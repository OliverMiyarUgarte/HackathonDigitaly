import { ApiProperty } from '@nestjs/swagger';
import {
  PRE_CONSULT_QUESTION_KEYS,
  type PreConsultAnswerInputDto as PreConsultAnswerInput,
  type PreConsultQuestionKey,
} from '@telemed/service-contracts';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class PreConsultAnswerInputDto implements PreConsultAnswerInput {
  @ApiProperty({ enum: PRE_CONSULT_QUESTION_KEYS })
  @IsIn(PRE_CONSULT_QUESTION_KEYS)
  questionKey!: PreConsultQuestionKey;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  answer!: string;
}
